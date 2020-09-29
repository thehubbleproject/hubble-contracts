pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { BLSAccountRegistry } from "./BLSAccountRegistry.sol";
import { Logger } from "./Logger.sol";
import { POB } from "./POB.sol";
import { MerkleTreeUtils, MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Governance } from "./Governance.sol";
import { DepositManager } from "./DepositManager.sol";
import { Transfer } from "./Transfer.sol";
import { MassMigration } from "./MassMigrations.sol";

contract RollupSetup {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.Commitment;
    using Types for Types.TransferCommitment;
    using Types for Types.MassMigrationCommitment;

    /*********************
     * Variable Declarations *
     ********************/

    // External contracts
    DepositManager public depositManager;
    BLSAccountRegistry public accountRegistry;
    Logger public logger;
    ITokenRegistry public tokenRegistry;
    Registry public nameRegistry;
    Types.Batch[] public batches;
    MerkleTreeUtils public merkleUtils;

    Transfer public transfer;
    MassMigration public massMigration;

    address payable constant BURN_ADDRESS = 0x0000000000000000000000000000000000000000;
    uint256 STAKE_AMOUNT;
    Governance public governance;

    // this variable will be greater than 0 if
    // there is rollback in progress
    // will be reset to 0 once rollback is completed
    uint256 public invalidBatchMarker;

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.POB())
        );
        assert(msg.sender == pobContract.getCoordinator());
        require(msg.value >= STAKE_AMOUNT, "Not enough stake committed");
        _;
    }

    modifier isNotRollingBack() {
        assert(invalidBatchMarker == 0);
        _;
    }

    modifier isRollingBack() {
        assert(invalidBatchMarker > 0);
        _;
    }
    modifier isDisputable(uint256 _batch_id) {
        require(
            !batches[_batch_id].withdrawn,
            "No point dispute a withdrawn batch"
        );
        require(
            block.number < batches[_batch_id].finalisesOn,
            "Batch already finalised"
        );

        require(
            _batch_id < invalidBatchMarker || invalidBatchMarker == 0,
            "Already successfully disputed. Roll back in process"
        );
        _;
    }

    function checkInclusion(
        bytes32 root,
        Types.CommitmentInclusionProof memory proof
    ) internal pure returns (bool) {
        return
            MerkleTreeUtilsLib.verifyLeaf(
                root,
                proof.commitment.toHash(),
                proof.pathToCommitment,
                proof.witness
            );
    }

    modifier checkPreviousCommitment(
        uint256 _batch_id,
        Types.CommitmentInclusionProof memory previous,
        uint256 targetPathToCommitment
    ) {
        if (targetPathToCommitment == 0) {
            // target is the first commit in the batch, so the previous commit is in the previous batch
            require(
                checkInclusion(batches[_batch_id - 1].commitmentRoot, previous),
                "previous commitment is absent in the previous batch"
            );
        } else {
            // target and previous commits are both in the current batch
            require(
                previous.pathToCommitment == targetPathToCommitment - 1,
                "previous commitment has wrong path"
            );
            require(
                checkInclusion(batches[_batch_id].commitmentRoot, previous),
                "previous commitment is absent in the current batch"
            );
        }
        _;
    }
}

contract RollupHelpers is RollupSetup {
    /**
     * @notice Returns the latest state root
     */
    function getLatestBalanceTreeRoot() public view returns (bytes32) {
        return batches[batches.length - 1].commitmentRoot;
    }

    /**
     * @notice Returns the total number of batches submitted
     */
    function numOfBatchesSubmitted() public view returns (uint256) {
        return batches.length;
    }

    /**
     * @notice Returns the batch
     */
    function getBatch(uint256 _batch_id)
        external
        view
        returns (Types.Batch memory batch)
    {
        require(
            batches.length - 1 >= _batch_id,
            "Batch id greater than total number of batches, invalid batch id"
        );
        batch = batches[_batch_id];
    }

    /**
     * @notice SlashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challengers. Also deletes all the batches after invalid batch
     * Its a public function because we will need to pause if we are not able to delete all batches in one tx
     */
    function SlashAndRollback() public isRollingBack {
        uint256 challengerRewards = 0;
        uint256 burnedAmount = 0;
        uint256 totalSlashings = 0;

        for (uint256 i = batches.length - 1; i >= invalidBatchMarker; i--) {
            // if gas left is low we would like to do all the transfers
            // and persist intermediate states so someone else can send another tx
            // and rollback remaining batches
            if (gasleft() <= governance.MIN_GAS_LIMIT_LEFT()) {
                // exit loop gracefully
                break;
            }

            // load batch
            Types.Batch memory batch = batches[i];

            // calculate challeger's reward
            uint256 _challengerReward = (STAKE_AMOUNT.mul(2)).div(3);
            challengerRewards += _challengerReward;
            burnedAmount += STAKE_AMOUNT.sub(_challengerReward);

            // delete batch
            delete batches[i];

            // queue deposits again
            depositManager.reenqueue(batch.depositRoot);

            totalSlashings++;

            logger.logBatchRollback(i);

            if (i == invalidBatchMarker) {
                // we have completed rollback
                // update the marker
                invalidBatchMarker = 0;
                break;
            }
        }

        // transfer reward to challenger
        (msg.sender).transfer(challengerRewards);

        // burn the remaning amount
        (BURN_ADDRESS).transfer(burnedAmount);

        // resize batches length
        batches.length = batches.length.sub(totalSlashings);

        logger.logRollbackFinalisation(totalSlashings);
    }

    function checkInclusion(
        bytes32 root,
        Types.TransferCommitmentInclusionProof memory proof
    ) internal pure returns (bool) {
        return
            MerkleTreeUtilsLib.verifyLeaf(
                root,
                proof.commitment.toHash(),
                proof.pathToCommitment,
                proof.witness
            );
    }

    function checkInclusion(
        bytes32 root,
        Types.MMCommitmentInclusionProof memory proof
    ) internal pure returns (bool) {
        return
            MerkleTreeUtilsLib.verifyLeaf(
                root,
                proof.commitment.toHash(),
                proof.pathToCommitment,
                proof.witness
            );
    }
}

contract Rollup is RollupHelpers {
    bytes32
        public constant ZERO_BYTES32 = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    uint256[2] public ZERO_AGG_SIG = [0, 0];
    bytes32 public APP_ID;

    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr, bytes32 genesisStateRoot) public {
        nameRegistry = Registry(_registryAddr);

        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.DEPOSIT_MANAGER())
        );

        governance = Governance(
            nameRegistry.getContractDetails(ParamManager.Governance())
        );
        merkleUtils = MerkleTreeUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        accountRegistry = BLSAccountRegistry(
            nameRegistry.getContractDetails(ParamManager.ACCOUNT_REGISTRY())
        );

        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );

        transfer = Transfer(
            nameRegistry.getContractDetails(ParamManager.TRANSFER())
        );
        massMigration = MassMigration(
            nameRegistry.getContractDetails(ParamManager.MASS_MIGS())
        );

        STAKE_AMOUNT = governance.STAKE_AMOUNT();
        bytes32[] memory genesisCommitments = new bytes32[](1);
        genesisCommitments[0] = keccak256(
            abi.encodePacked(genesisStateRoot, ZERO_BYTES32)
        );
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: merkleUtils.getMerkleRootFromLeaves(
                genesisCommitments
            ),
            committer: msg.sender,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            depositRoot: ZERO_BYTES32,
            withdrawn: false
        });
        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            genesisStateRoot,
            batches.length - 1,
            Types.Usage.Genesis
        );
        APP_ID = keccak256(abi.encodePacked(address(this)));
    }

    function submitBatch(bytes32[] memory commitments, Types.Usage batchType)
        internal
    {
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: merkleUtils.getMerkleRootFromLeaves(commitments),
            committer: msg.sender,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            depositRoot: ZERO_BYTES32,
            withdrawn: false
        });
        batches.push(newBatch);
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitTransferBatch(
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[] calldata tokenTypes,
        uint256[] calldata feeReceivers,
        bytes[] calldata txss
    ) external payable onlyCoordinator {
        bytes32[] memory leaves = new bytes32[](stateRoots.length);
        bytes32 accountRoot = accountRegistry.root();
        bytes32 bodyRoot;
        for (uint256 i = 0; i < stateRoots.length; i++) {
            // This is TransferBody toHash() but we don't want the overhead of struct
            bodyRoot = keccak256(
                abi.encodePacked(
                    accountRoot,
                    signatures[i],
                    tokenTypes[i],
                    feeReceivers[i],
                    txss[i]
                )
            );
            leaves[i] = keccak256(abi.encodePacked(stateRoots[i], bodyRoot));
        }
        submitBatch(leaves, Types.Usage.Transfer);
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitCreate2TransferBatch(
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[] calldata tokenTypes,
        uint256[] calldata feeReceivers,
        bytes[] calldata txss
    ) external payable onlyCoordinator {
        bytes32[] memory leaves = new bytes32[](stateRoots.length);
        bytes32 accountRoot = accountRegistry.root();
        bytes32 bodyRoot;
        for (uint256 i = 0; i < stateRoots.length; i++) {
            // This is TransferBody toHash() but we don't want the overhead of struct
            bodyRoot = keccak256(
                abi.encodePacked(
                    accountRoot,
                    signatures[i],
                    tokenTypes[i],
                    feeReceivers[i],
                    txss[i]
                )
            );
            leaves[i] = keccak256(abi.encodePacked(stateRoots[i], bodyRoot));
        }
        submitBatch(leaves, Types.Usage.Create2Transfer);
    }

    /**
     * @param meta is targetSpokeID, tokenID, and amount combined
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitMassMigrationBatch(
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[3][] calldata meta,
        bytes32[] calldata withdrawRoots,
        bytes[] calldata txss
    ) external payable onlyCoordinator {
        bytes32[] memory leaves = new bytes32[](stateRoots.length);
        bytes32 accountRoot = accountRegistry.root();
        bytes32 bodyRoot;
        for (uint256 i = 0; i < stateRoots.length; i++) {
            // This is MassMigrationBody toHash() but we don't want the overhead of struct
            bodyRoot = keccak256(
                abi.encodePacked(
                    accountRoot,
                    signatures[i],
                    meta[i][0],
                    withdrawRoots[i],
                    meta[i][1],
                    meta[i][2],
                    txss[i]
                )
            );
            leaves[i] = keccak256(abi.encodePacked(stateRoots[i], bodyRoot));
        }
        submitBatch(leaves, Types.Usage.MassMigration);
    }

    /**
     * @notice finalise deposits and submit batch
     */
    function finaliseDepositsAndSubmitBatch(
        uint256 _subTreeDepth,
        Types.StateMerkleProofWithPath calldata zero
    ) external payable onlyCoordinator isNotRollingBack {
        bytes32 depositSubTreeRoot = depositManager.finaliseDeposits(
            _subTreeDepth,
            zero,
            getLatestBalanceTreeRoot()
        );

        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            depositSubTreeRoot,
            zero.path,
            zero.witness
        );

        bytes32[] memory depositCommitments = new bytes32[](1);
        depositCommitments[0] = keccak256(
            abi.encodePacked(newRoot, ZERO_BYTES32)
        );

        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: merkleUtils.getMerkleRootFromLeaves(
                depositCommitments
            ),
            committer: msg.sender,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            depositRoot: depositSubTreeRoot,
            withdrawn: false
        });

        batches.push(newBatch);

        logger.logNewBatch(
            newBatch.committer,
            newRoot,
            batches.length - 1,
            Types.Usage.Deposit
        );
    }

    /**
     *  disputeBatch processes a transactions and returns the updated balance tree
     *  and the updated leaves.
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function disputeBatch(
        uint256 _batch_id,
        Types.CommitmentInclusionProof memory previous,
        Types.TransferCommitmentInclusionProof memory target,
        Types.StateMerkleProof[] memory proofs
    )
        public
        isDisputable(_batch_id)
        checkPreviousCommitment(_batch_id, previous, target.pathToCommitment)
    {
        require(
            checkInclusion(batches[_batch_id].commitmentRoot, target),
            "Target commitment is absent in the batch"
        );

        (bytes32 processedStateRoot, bool isDisputeValid) = transfer
            .processTransferCommit(
            previous.commitment.stateRoot,
            target.commitment.body.txs,
            proofs,
            target.commitment.body.tokenType,
            target.commitment.body.feeReceiver
        );

        if (
            isDisputeValid ||
            (processedStateRoot != target.commitment.stateRoot)
        ) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = _batch_id;
            SlashAndRollback();
            return;
        }
    }

    function disputeMMBatch(
        uint256 _batch_id,
        Types.CommitmentInclusionProof memory previous,
        Types.MMCommitmentInclusionProof memory target,
        Types.StateMerkleProof[] memory proofs
    )
        public
        isDisputable(_batch_id)
        checkPreviousCommitment(_batch_id, previous, target.pathToCommitment)
    {
        require(
            checkInclusion(batches[_batch_id].commitmentRoot, target),
            "Target commitment is absent in the batch"
        );

        (bytes32 processedStateRoot, bool isDisputeValid) = massMigration
            .processMassMigrationCommit(
            previous.commitment.stateRoot,
            target.commitment.body,
            proofs
        );

        if (
            isDisputeValid ||
            (processedStateRoot != target.commitment.stateRoot)
        ) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = _batch_id;
            SlashAndRollback();
            return;
        }
    }

    function disputeSignature(
        uint256 batchID,
        Types.TransferCommitmentInclusionProof memory target,
        Types.SignatureProof memory signatureProof
    ) public isDisputable(batchID) {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Rollup: Commitment not present in batch"
        );

        Types.ErrorCode errCode = transfer.checkSignature(
            target.commitment.body.signature,
            signatureProof,
            target.commitment.stateRoot,
            target.commitment.body.accountRoot,
            APP_ID,
            target.commitment.body.txs
        );

        if (errCode != Types.ErrorCode.NoError) {
            invalidBatchMarker = batchID;
            SlashAndRollback();
        }
    }

    function disputeSignatureinMM(
        uint256 batchID,
        Types.MMCommitmentInclusionProof memory target,
        Types.SignatureProof memory signatureProof
    ) public isDisputable(batchID) {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Commitment not present in batch"
        );

        Types.ErrorCode errCode = transfer.checkSignature(
            target.commitment.body.signature,
            signatureProof,
            target.commitment.stateRoot,
            target.commitment.body.accountRoot,
            APP_ID,
            target.commitment.body.txs
        );

        if (errCode != Types.ErrorCode.NoError) {
            invalidBatchMarker = batchID;
            SlashAndRollback();
        }
    }

    /**
     * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
     * @param batch_id Batch ID that the coordinator submitted
     */
    function WithdrawStake(uint256 batch_id) public {
        Types.Batch memory committedBatch = batches[batch_id];
        require(
            !committedBatch.withdrawn,
            "Stake has been already withdrawn!!"
        );
        require(
            msg.sender == committedBatch.committer,
            "You are not the correct committer for this batch"
        );
        require(
            block.number > committedBatch.finalisesOn,
            "This batch is not yet finalised, check back soon!"
        );
        committedBatch.withdrawn = true;

        msg.sender.transfer(STAKE_AMOUNT);
        logger.logStakeWithdraw(msg.sender, batch_id);
    }
}
