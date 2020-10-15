pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { BLSAccountRegistry } from "./BLSAccountRegistry.sol";
import { Logger } from "./Logger.sol";
import { POB } from "./POB.sol";
import { MerkleTreeUtils, MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Governance } from "./Governance.sol";
import { DepositManager } from "./DepositManager.sol";
import { Transfer } from "./Transfer.sol";
import { MassMigration } from "./MassMigrations.sol";
import { StakeManager } from "./StakeManager.sol";

contract RollupSetup {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.Batch;
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
    Registry public nameRegistry;
    Types.Batch[] public batches;
    MerkleTreeUtils public merkleUtils;

    Transfer public transfer;
    MassMigration public massMigration;

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
    modifier isDisputable(uint256 batchID) {
        require(
            block.number < batches[batchID].finaliseOn(),
            "Batch already finalised"
        );

        require(
            batchID < invalidBatchMarker || invalidBatchMarker == 0,
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
        uint256 batchID,
        Types.CommitmentInclusionProof memory previous,
        uint256 targetPathToCommitment
    ) {
        uint256 previousPath = 0;
        uint256 expectedBatchID = 0;
        if (targetPathToCommitment == 0) {
            // target is the first commit in the batch, so the previous commit is in the previous batch
            expectedBatchID = batchID - 1;
            previousPath = batches[expectedBatchID].commitmentLength() - 1;
        } else {
            // target and previous commits are both in the current batch
            expectedBatchID = batchID;
            previousPath = targetPathToCommitment - 1;
        }
        require(
            previous.pathToCommitment == previousPath,
            "previous commitment has wrong path"
        );
        require(
            checkInclusion(batches[expectedBatchID].commitmentRoot, previous),
            "previous commitment is absent in the current batch"
        );
        _;
    }
}

contract RollupHelpers is RollupSetup, StakeManager {
    /**
     * @notice Returns the total number of batches submitted
     */
    function numOfBatchesSubmitted() public view returns (uint256) {
        return batches.length;
    }

    /**
     * @notice Returns the batch
     */
    function getBatch(uint256 batchID)
        external
        view
        returns (Types.Batch memory batch)
    {
        require(
            batches.length - 1 >= batchID,
            "Batch id greater than total number of batches, invalid batch id"
        );
        batch = batches[batchID];
    }

    /**
     * @notice slashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challengers. Also deletes all the batches after invalid batch
     * Its a public function because we will need to pause if we are not able to delete all batches in one tx
     */
    function slashAndRollback() public isRollingBack {
        uint256 totalSlashings = 0;
        uint256 initialBatchID = batches.length - 1;

        for (
            uint256 batchID = initialBatchID;
            batchID >= invalidBatchMarker;
            batchID--
        ) {
            // if gas left is low we would like to do all the transfers
            // and persist intermediate states so someone else can send another tx
            // and rollback remaining batches
            if (gasleft() <= governance.minGasLeft()) {
                // exit loop gracefully
                break;
            }
            // delete batch
            delete batches[batchID];

            // queue deposits again
            depositManager.tryReenqueue(batchID);

            totalSlashings++;

            logger.logBatchRollback(batchID);

            if (batchID == invalidBatchMarker) {
                // we have completed rollback
                // update the marker
                invalidBatchMarker = 0;
                break;
            }
        }
        rewardAndBurn(msg.sender, initialBatchID, totalSlashings);
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

    bytes32 public appID;

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
        transfer = Transfer(
            nameRegistry.getContractDetails(ParamManager.TRANSFER())
        );
        massMigration = MassMigration(
            nameRegistry.getContractDetails(ParamManager.MASS_MIGS())
        );

        changeStakeAmount(governance.stakeAmount());
        bytes32 genesisCommitment = keccak256(
            abi.encode(genesisStateRoot, ZERO_BYTES32)
        );
        // Same effect as `merkleUtils.getMerkleRootFromLeaves`
        bytes32 commitmentRoot = keccak256(
            abi.encode(genesisCommitment, ZERO_BYTES32)
        );
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(Types.Usage.Genesis),
                1,
                msg.sender,
                block.number // genesis finalise instantly
            )
        });
        batches.push(newBatch);
        logger.logNewBatch(
            msg.sender,
            genesisStateRoot,
            batches.length - 1,
            Types.Usage.Genesis
        );
        appID = keccak256(abi.encodePacked(address(this)));
    }

    function submitBatch(
        bytes32 commitmentRoot,
        uint256 commitmentLength,
        Types.Usage batchType
    ) internal {
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(batchType),
                commitmentLength,
                msg.sender,
                block.number + governance.timeToFinalise()
            )
        });
        batches.push(newBatch);
        stake(batches.length - 1);
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitTransfer(
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
        submitBatch(
            merkleUtils.getMerkleRootFromLeaves(leaves),
            stateRoots.length,
            Types.Usage.Transfer
        );
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitCreate2Transfer(
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
        submitBatch(
            merkleUtils.getMerkleRootFromLeaves(leaves),
            stateRoots.length,
            Types.Usage.Create2Transfer
        );
    }

    /**
     * @param meta is targetSpokeID, tokenID, and amount combined
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitMassMigration(
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
        submitBatch(
            merkleUtils.getMerkleRootFromLeaves(leaves),
            stateRoots.length,
            Types.Usage.MassMigration
        );
    }

    function submitDeposits(
        Types.CommitmentInclusionProof memory previous,
        Types.SubtreeVacancyProof memory vacant
    ) public payable onlyCoordinator isNotRollingBack {
        uint256 preBatchID = batches.length - 1;
        require(
            previous.pathToCommitment ==
                batches[preBatchID].commitmentLength() - 1,
            "previous commitment has wrong path"
        );
        require(
            checkInclusion(batches[preBatchID].commitmentRoot, previous),
            "previous commitment is absent in the previous batch"
        );
        require(
            merkleUtils.verifyLeaf(
                previous.commitment.stateRoot,
                merkleUtils.getRoot(vacant.depth),
                vacant.pathAtDepth,
                vacant.witness
            ),
            "Rollup: State subtree is not vacant"
        );
        uint256 postBatchID = preBatchID + 1;
        // This deposit subtree is included in the batch whose ID is postBatchID
        bytes32 depositSubTreeRoot = depositManager.dequeueToSubmit(
            postBatchID
        );
        logger.logDepositFinalised(depositSubTreeRoot, vacant.pathAtDepth);

        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            depositSubTreeRoot,
            vacant.pathAtDepth,
            vacant.witness
        );
        bytes32 depositCommitment = keccak256(
            abi.encode(newRoot, ZERO_BYTES32)
        );
        // Same effect as `merkleUtils.getMerkleRootFromLeaves`
        bytes32 root = keccak256(abi.encode(depositCommitment, ZERO_BYTES32));
        submitBatch(root, 1, Types.Usage.MassMigration);
    }

    /**
     *  disputeBatch processes a transactions and returns the updated balance tree
     *  and the updated leaves.
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function disputeTransitionTransfer(
        uint256 batchID,
        Types.CommitmentInclusionProof memory previous,
        Types.TransferCommitmentInclusionProof memory target,
        Types.StateMerkleProof[] memory proofs
    )
        public
        isDisputable(batchID)
        checkPreviousCommitment(batchID, previous, target.pathToCommitment)
    {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Target commitment is absent in the batch"
        );

        (bytes32 processedStateRoot, Types.Result result) = transfer
            .processTransferCommit(
            previous.commitment.stateRoot,
            target.commitment.body.txs,
            proofs,
            target.commitment.body.tokenType,
            target.commitment.body.feeReceiver
        );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = batchID;
            slashAndRollback();
            return;
        }
    }

    function disputeTransitionMassMigration(
        uint256 batchID,
        Types.CommitmentInclusionProof memory previous,
        Types.MMCommitmentInclusionProof memory target,
        Types.StateMerkleProof[] memory proofs
    )
        public
        isDisputable(batchID)
        checkPreviousCommitment(batchID, previous, target.pathToCommitment)
    {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Target commitment is absent in the batch"
        );

        (bytes32 processedStateRoot, Types.Result result) = massMigration
            .processMassMigrationCommit(
            previous.commitment.stateRoot,
            target.commitment.body,
            proofs
        );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = batchID;
            slashAndRollback();
            return;
        }
    }

    function disputeSignatureTransfer(
        uint256 batchID,
        Types.TransferCommitmentInclusionProof memory target,
        Types.SignatureProof memory signatureProof
    ) public isDisputable(batchID) {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Rollup: Commitment not present in batch"
        );

        Types.Result result = transfer.checkSignature(
            target.commitment.body.signature,
            signatureProof,
            target.commitment.stateRoot,
            target.commitment.body.accountRoot,
            appID,
            target.commitment.body.txs
        );

        if (result != Types.Result.Ok) {
            invalidBatchMarker = batchID;
            slashAndRollback();
        }
    }

    function disputeSignatureMassMigration(
        uint256 batchID,
        Types.MMCommitmentInclusionProof memory target,
        Types.SignatureProof memory signatureProof
    ) public isDisputable(batchID) {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Commitment not present in batch"
        );

        Types.Result result = massMigration.checkSignature(
            target.commitment.body.signature,
            signatureProof,
            target.commitment.stateRoot,
            target.commitment.body.accountRoot,
            appID,
            target.commitment.body.targetSpokeID,
            target.commitment.body.txs
        );

        if (result != Types.Result.Ok) {
            invalidBatchMarker = batchID;
            slashAndRollback();
        }
    }

    /**
     * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
     */
    function withdrawStake(uint256 batchID) public {
        require(
            msg.sender == batches[batchID].committer(),
            "You are not the correct committer for this batch"
        );
        require(
            block.number > batches[batchID].finaliseOn(),
            "This batch is not yet finalised, check back soon!"
        );
        withdraw(msg.sender, batchID);
        logger.logStakeWithdraw(msg.sender, batchID);
    }
}
