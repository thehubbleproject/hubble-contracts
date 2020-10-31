pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ParamManager } from "../libs/ParamManager.sol";
import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";
import { BLSAccountRegistry } from "../BLSAccountRegistry.sol";
import { Logger } from "../Logger.sol";
import { POB } from "../POB.sol";
import { MerkleTree } from "../libs/MerkleTree.sol";
import { NameRegistry as Registry } from "../NameRegistry.sol";
import { DepositManager } from "../DepositManager.sol";
import { Transfer } from "../Transfer.sol";
import { MassMigration } from "../MassMigrations.sol";
import { StakeManager } from "./StakeManager.sol";
import { Parameters } from "./Parameters.sol";
import { BatchManager } from "./BatchManager.sol";

contract Rollup is StakeManager, Parameters, BatchManager {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.Batch;
    using Types for Types.Commitment;
    using Types for Types.TransferCommitment;
    using Types for Types.MassMigrationCommitment;

    // External contracts
    DepositManager public depositManager;
    BLSAccountRegistry public accountRegistry;
    Logger public logger;
    Registry public nameRegistry;
    Transfer public transfer;
    MassMigration public massMigration;

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.proofOfBurn())
        );
        assert(msg.sender == pobContract.getCoordinator());
        _;
    }

    function startSlash(uint256 batchID) internal {
        invalidBatchMarker = batchID;
        keepSlashAndRollback();
    }

    /**
     * @notice slashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challengers. Also deletes all the batches after invalid batch
     * Its a public function because we will need to pause if we are not able to delete all batches in one tx
     */
    function keepSlashAndRollback() public isRollingBack {
        uint256 totalSlashings = 0;
        uint256 batchID = batches.length - 1;

        for (; batchID >= invalidBatchMarker; batchID--) {
            if (gasleft() <= paramMinGasLeft) break;

            delete batches[batchID];

            // queue deposits again
            depositManager.tryReenqueue(batchID);

            totalSlashings++;

            logger.logBatchRollback(batchID);
        }
        // if rollback is completed, update the marker
        if (batchID == invalidBatchMarker) invalidBatchMarker = 0;
        rewardAndBurn(msg.sender, initialBatchID, totalSlashings);
        // resize batches length
        batches.length = batches.length.sub(totalSlashings);

        logger.logRollbackFinalisation(totalSlashings);
    }

    bytes32
        public constant ZERO_BYTES32 = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    bytes32 public appID;

    constructor(address _registryAddr, bytes32 genesisStateRoot) public {
        nameRegistry = Registry(_registryAddr);

        logger = Logger(nameRegistry.getContractDetails(ParamManager.logger()));
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.depositManager())
        );
        accountRegistry = BLSAccountRegistry(
            nameRegistry.getContractDetails(ParamManager.accountRegistry())
        );
        transfer = Transfer(
            nameRegistry.getContractDetails(ParamManager.transferSimple())
        );
        massMigration = MassMigration(
            nameRegistry.getContractDetails(ParamManager.massMigration())
        );

        bytes32 genesisCommitment = keccak256(
            abi.encode(genesisStateRoot, ZERO_BYTES32)
        );
        // Same effect as `MerkleTree.merklise`
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
        logger.logNewBatch(msg.sender, batches.length - 1, Types.Usage.Genesis);
        appID = keccak256(abi.encodePacked(address(this)));
    }

    function submitBatch(
        bytes32 commitmentRoot,
        uint256 size,
        Types.Usage batchType
    ) internal {
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(batchType),
                size,
                msg.sender,
                block.number + paramBlocksToFinalise
            )
        });
        batches.push(newBatch);
        stake(batches.length - 1, paramStakeAmount);
        logger.logNewBatch(msg.sender, batches.length - 1, batchType);
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitTransfer(
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
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
                    feeReceivers[i],
                    txss[i]
                )
            );
            leaves[i] = keccak256(abi.encodePacked(stateRoots[i], bodyRoot));
        }
        submitBatch(
            MerkleTree.merklise(leaves),
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
                    feeReceivers[i],
                    txss[i]
                )
            );
            leaves[i] = keccak256(abi.encodePacked(stateRoots[i], bodyRoot));
        }
        submitBatch(
            MerkleTree.merklise(leaves),
            stateRoots.length,
            Types.Usage.Create2Transfer
        );
    }

    /**
     * @param meta is spokeID, tokenID, amount, and feeReceiver combined
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitMassMigration(
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[4][] calldata meta,
        bytes32[] calldata withdrawRoots,
        bytes[] calldata txss
    ) external payable onlyCoordinator {
        bytes32[] memory leaves = new bytes32[](stateRoots.length);
        bytes32 accountRoot = accountRegistry.root();
        for (uint256 i = 0; i < stateRoots.length; i++) {
            Types.MassMigrationBody memory body = Types.MassMigrationBody(
                accountRoot,
                signatures[i],
                meta[i][0],
                withdrawRoots[i],
                meta[i][1],
                meta[i][2],
                meta[i][3],
                txss[i]
            );
            leaves[i] = keccak256(
                abi.encodePacked(stateRoots[i], Types.toHash(body))
            );
        }
        submitBatch(
            MerkleTree.merklise(leaves),
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
            previous.path == batches[preBatchID].size() - 1,
            "previous commitment has wrong path"
        );
        require(
            checkInclusion(batches[preBatchID].commitmentRoot, previous),
            "previous commitment is absent in the previous batch"
        );
        require(
            MerkleTree.verify(
                previous.commitment.stateRoot,
                MerkleTree.getRoot(vacant.depth),
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

        bytes32 newRoot = MerkleTree.computeRoot(
            depositSubTreeRoot,
            vacant.pathAtDepth,
            vacant.witness
        );
        bytes32 depositCommitment = keccak256(
            abi.encode(newRoot, ZERO_BYTES32)
        );
        // Same effect as `MerkleTree.merklise`
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
        checkPreviousCommitment(batchID, previous, target.path)
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
            target.commitment.body.feeReceiver
        );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startSlash(batchID);
    }

    function disputeTransitionMassMigration(
        uint256 batchID,
        Types.CommitmentInclusionProof memory previous,
        Types.MMCommitmentInclusionProof memory target,
        Types.StateMerkleProof[] memory proofs
    )
        public
        isDisputable(batchID)
        checkPreviousCommitment(batchID, previous, target.path)
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
        ) startSlash(batchID);
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

        if (result != Types.Result.Ok) startSlash(batchID);
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
            target.commitment.body.spokeID,
            target.commitment.body.txs
        );

        if (result != Types.Result.Ok) startSlash(batchID);
    }

    /**
     * @notice coordinators can withdraw their stake after the batch has been finalised
     */
    function withdrawStake(uint256 batchID) external {
        require(
            msg.sender == batches[batchID].committer(),
            "Incorrect committer"
        );
        require(
            block.number > batches[batchID].finaliseOn(),
            "Not finalised yet"
        );
        withdraw(msg.sender, batchID);
        logger.logStakeWithdraw(msg.sender, batchID);
    }
}
