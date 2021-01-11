pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";
import { BLSAccountRegistry } from "../BLSAccountRegistry.sol";
import { Chooser } from "../proposers/Chooser.sol";
import { MerkleTree } from "../libs/MerkleTree.sol";
import { Transfer } from "../Transfer.sol";
import { MassMigration } from "../MassMigrations.sol";
import { Create2Transfer } from "../Create2Transfer.sol";
import { BatchManager } from "./BatchManager.sol";
import { IDepositManager } from "../DepositManager.sol";

contract RollupCore is BatchManager {
    using Tx for bytes;
    using Types for Types.Commitment;
    using Types for Types.TransferCommitment;
    using Types for Types.MassMigrationCommitment;

    // External contracts
    BLSAccountRegistry public accountRegistry;
    Transfer public transfer;
    MassMigration public massMigration;
    Create2Transfer public create2Transfer;

    bytes32
        public constant ZERO_BYTES32 = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    bytes32 public appID;

    event DepositsFinalised(bytes32 depositSubTreeRoot, uint256 pathToSubTree);

    modifier onlyCoordinator() {
        require(
            msg.sender == chooser.getProposer(),
            "Rollup: Invalid proposer"
        );
        _;
    }

    function checkInclusion(
        bytes32 root,
        Types.CommitmentInclusionProof memory proof
    ) internal pure returns (bool) {
        return
            MerkleTree.verify(
                root,
                proof.commitment.toHash(),
                proof.path,
                proof.witness
            );
    }

    modifier checkPreviousCommitment(
        uint256 batchID,
        Types.CommitmentInclusionProof memory previous,
        uint256 targetPath
    ) {
        uint256 previousPath = 0;
        uint256 expectedBatchID = 0;
        if (targetPath == 0) {
            // target is the first commit in the batch, so the previous commit is in the previous batch
            expectedBatchID = batchID - 1;
            previousPath = batches[expectedBatchID].size() - 1;
        } else {
            // target and previous commits are both in the current batch
            expectedBatchID = batchID;
            previousPath = targetPath - 1;
        }
        require(
            previous.path == previousPath,
            "previous commitment has wrong path"
        );
        require(
            checkInclusion(batches[expectedBatchID].commitmentRoot, previous),
            "previous commitment is absent in the current batch"
        );
        _;
    }

    function checkInclusion(
        bytes32 root,
        Types.TransferCommitmentInclusionProof memory proof
    ) internal pure returns (bool) {
        return
            MerkleTree.verify(
                root,
                proof.commitment.toHash(),
                proof.path,
                proof.witness
            );
    }

    function checkInclusion(
        bytes32 root,
        Types.MMCommitmentInclusionProof memory proof
    ) internal pure returns (bool) {
        return
            MerkleTree.verify(
                root,
                proof.commitment.toHash(),
                proof.path,
                proof.witness
            );
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitTransfer(
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[] calldata feeReceivers,
        bytes[] calldata txss
    ) external payable onlyCoordinator isNotRollingBack {
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
    ) external payable onlyCoordinator isNotRollingBack {
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
    ) external payable onlyCoordinator isNotRollingBack {
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
        uint256 preBatchID = nextBatchID - 1;
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
        bytes32 depositSubTreeRoot = depositManager.dequeueToSubmit();
        uint256 postBatchID = preBatchID + 1;
        // This deposit subtree is included in the batch whose ID is postBatchID
        deposits[postBatchID] = depositSubTreeRoot;
        emit DepositsFinalised(depositSubTreeRoot, vacant.pathAtDepth);

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
        submitBatch(root, 1, Types.Usage.Deposit);
    }

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
            paramMaxTxsPerCommit,
            target.commitment.body.feeReceiver,
            target.commitment.body.txs,
            proofs
        );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startRollingBack(batchID);
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
            paramMaxTxsPerCommit,
            target.commitment.body,
            proofs
        );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startRollingBack(batchID);
    }

    function disputeTransitionCreate2Transfer(
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

        (bytes32 processedStateRoot, Types.Result result) = create2Transfer
            .processCreate2TransferCommit(
            previous.commitment.stateRoot,
            paramMaxTxsPerCommit,
            target.commitment.body.feeReceiver,
            target.commitment.body.txs,
            proofs
        );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startRollingBack(batchID);
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

        if (result != Types.Result.Ok) startRollingBack(batchID);
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

        if (result != Types.Result.Ok) startRollingBack(batchID);
    }

    function disputeSignatureCreate2Transfer(
        uint256 batchID,
        Types.TransferCommitmentInclusionProof memory target,
        Types.SignatureProofWithReceiver memory signatureProof
    ) public isDisputable(batchID) {
        require(
            checkInclusion(batches[batchID].commitmentRoot, target),
            "Rollup: Commitment not present in batch"
        );

        Types.Result result = create2Transfer.checkSignature(
            target.commitment.body.signature,
            signatureProof,
            target.commitment.stateRoot,
            target.commitment.body.accountRoot,
            appID,
            target.commitment.body.txs
        );

        if (result != Types.Result.Ok) startRollingBack(batchID);
    }
}

contract Rollup is RollupCore {
    constructor(
        Chooser _chooser,
        IDepositManager _depositManager,
        BLSAccountRegistry _accountRegistry,
        Transfer _transfer,
        MassMigration _massMigration,
        Create2Transfer _create2Transfer,
        bytes32 genesisStateRoot,
        uint256 stakeAmount,
        uint256 blocksToFinalise,
        uint256 minGasLeft,
        uint256 maxTxsPerCommit
    ) public {
        chooser = _chooser;
        depositManager = _depositManager;
        accountRegistry = _accountRegistry;
        transfer = _transfer;
        massMigration = _massMigration;
        create2Transfer = _create2Transfer;

        paramStakeAmount = stakeAmount;
        paramBlocksToFinalise = blocksToFinalise;
        paramMinGasLeft = minGasLeft;
        paramMaxTxsPerCommit = maxTxsPerCommit;

        bytes32 genesisCommitment = keccak256(
            abi.encode(genesisStateRoot, ZERO_BYTES32)
        );

        // Same effect as `MerkleTree.merklise`
        bytes32 commitmentRoot = keccak256(
            abi.encode(genesisCommitment, ZERO_BYTES32)
        );
        batches[nextBatchID] = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(Types.Usage.Genesis),
                1,
                msg.sender,
                block.number // genesis finalise instantly
            )
        });
        emit NewBatch(msg.sender, nextBatchID, Types.Usage.Genesis);
        nextBatchID++;
        appID = keccak256(abi.encodePacked(address(this)));
    }
}
