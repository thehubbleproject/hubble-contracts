// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

// This moves in 4.x to openzeppelin/contracts/utils/cryptography/draft-EIP712.sol
import { EIP712 } from "@openzeppelin/contracts/drafts/EIP712.sol";
import { IEIP712 } from "../libs/EIP712.sol";
import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";
import { MerkleTree } from "../libs/MerkleTree.sol";
import { Chooser } from "../proposers/Chooser.sol";
import { BLSAccountRegistry } from "../BLSAccountRegistry.sol";
import { Transfer } from "../Transfer.sol";
import { MassMigration } from "../MassMigrations.sol";
import { Create2Transfer } from "../Create2Transfer.sol";
import { BatchManager } from "./BatchManager.sol";
import { IDepositManager } from "../DepositManager.sol";

/**
 * @notice Primary contract for submitting and disputing batches of transactions
 */
contract Rollup is BatchManager, EIP712, IEIP712 {
    using Tx for bytes;
    using Types for Types.Commitment;
    using Types for Types.TransferCommitment;
    using Types for Types.MassMigrationCommitment;

    string public constant DOMAIN_NAME = "Hubble";
    string public constant DOMAIN_VERSION = "1";

    bytes32 public constant ZERO_BYTES32 =
        0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    // External contracts
    BLSAccountRegistry public immutable accountRegistry;
    Transfer public immutable transfer;
    MassMigration public immutable massMigration;
    Create2Transfer public immutable create2Transfer;

    uint256 public immutable paramMaxTxsPerCommit;
    bytes32 public immutable zeroHashAtSubtreeDepth;

    event DepositsFinalised(
        uint256 subtreeID,
        bytes32 depositSubTreeRoot,
        uint256 pathToSubTree
    );

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
    )
        public
        BatchManager(
            stakeAmount,
            blocksToFinalise,
            minGasLeft,
            _chooser,
            _depositManager
        )
        EIP712(DOMAIN_NAME, DOMAIN_VERSION)
    {
        accountRegistry = _accountRegistry;
        transfer = _transfer;
        massMigration = _massMigration;
        create2Transfer = _create2Transfer;

        paramMaxTxsPerCommit = maxTxsPerCommit;
        zeroHashAtSubtreeDepth = MerkleTree.getRoot(
            _depositManager.paramMaxSubtreeDepth()
        );

        bytes32 genesisCommitment =
            keccak256(abi.encode(genesisStateRoot, ZERO_BYTES32));

        // Same effect as `MerkleTree.merklize`
        bytes32 commitmentRoot =
            keccak256(abi.encode(genesisCommitment, ZERO_BYTES32));
        batches[nextBatchID] = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(Types.Usage.Genesis),
                1,
                msg.sender,
                block.number // genesis finalise instantly
            )
        });
        // AccountRoot doesn't matter for genesis, add dummy value
        emit NewBatch(nextBatchID, bytes32(0), Types.Usage.Genesis);
        nextBatchID++;
    }

    modifier onlyCoordinator() {
        require(
            msg.sender == chooser.getProposer(),
            "Rollup: Invalid proposer"
        );
        _;
    }

    /**
     * @dev When running multiple batch submissions in a single transaction,
     * if one of the earlier batch submissions fails the latter submission
     * will still proceed, be invalid since it depended on the earlier
     * submission's state, and be slashed. To prevent this scenario,
     * verify the expected batchID matches nextBatchID when a
     * submission function is executed.
     *
     * @param batchID expected batch ID
     */
    modifier correctBatchID(uint256 batchID) {
        require(batchID == nextBatchID, "batchID does not match nextBatchID");
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

    function domainSeparator() public view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitTransfer(
        uint256 batchID,
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[] calldata feeReceivers,
        bytes[] calldata txss
    )
        external
        payable
        onlyCoordinator
        isNotRollingBack
        correctBatchID(batchID)
    {
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
            MerkleTree.merklize(leaves),
            stateRoots.length,
            accountRoot,
            Types.Usage.Transfer
        );
    }

    /**
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitCreate2Transfer(
        uint256 batchID,
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[] calldata feeReceivers,
        bytes[] calldata txss
    )
        external
        payable
        onlyCoordinator
        isNotRollingBack
        correctBatchID(batchID)
    {
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
            MerkleTree.merklize(leaves),
            stateRoots.length,
            accountRoot,
            Types.Usage.Create2Transfer
        );
    }

    /**
     * @param meta is spokeID, tokenID, amount, and feeReceiver combined
     * @dev This function should be highly optimized so that it can include as many commitments as possible
     */
    function submitMassMigration(
        uint256 batchID,
        bytes32[] calldata stateRoots,
        uint256[2][] calldata signatures,
        uint256[4][] calldata meta,
        bytes32[] calldata withdrawRoots,
        bytes[] calldata txss
    )
        external
        payable
        onlyCoordinator
        isNotRollingBack
        correctBatchID(batchID)
    {
        bytes32[] memory leaves = new bytes32[](stateRoots.length);
        bytes32 accountRoot = accountRegistry.root();
        for (uint256 i = 0; i < stateRoots.length; i++) {
            Types.MassMigrationBody memory body =
                Types.MassMigrationBody(
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
            MerkleTree.merklize(leaves),
            stateRoots.length,
            accountRoot,
            Types.Usage.MassMigration
        );
    }

    function submitDeposits(
        uint256 batchID,
        Types.CommitmentInclusionProof memory previous,
        Types.SubtreeVacancyProof memory vacant
    ) public payable onlyCoordinator isNotRollingBack correctBatchID(batchID) {
        uint256 preBatchID = batchID - 1;
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
                zeroHashAtSubtreeDepth,
                vacant.pathAtDepth,
                vacant.witness
            ),
            "Rollup: State subtree is not vacant"
        );
        (uint256 subtreeID, bytes32 depositSubTreeRoot) =
            depositManager.dequeueToSubmit();
        uint256 postBatchID = preBatchID + 1;
        // This deposit subtree is included in the batch whose ID is postBatchID
        deposits[postBatchID] = depositSubTreeRoot;
        emit DepositsFinalised(
            subtreeID,
            depositSubTreeRoot,
            vacant.pathAtDepth
        );

        bytes32 newRoot =
            MerkleTree.computeRoot(
                depositSubTreeRoot,
                vacant.pathAtDepth,
                vacant.witness
            );
        bytes32 depositCommitment =
            keccak256(abi.encode(newRoot, ZERO_BYTES32));
        // Same effect as `MerkleTree.merklize`
        bytes32 root = keccak256(abi.encode(depositCommitment, ZERO_BYTES32));
        // AccountRoot doesn't matter for deposit, add dummy value
        submitBatch(root, 1, bytes32(0), Types.Usage.Deposit);
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

        (bytes32 processedStateRoot, Types.Result result) =
            transfer.processTransferCommit(
                previous.commitment.stateRoot,
                paramMaxTxsPerCommit,
                target.commitment.body.feeReceiver,
                target.commitment.body.txs,
                proofs
            );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startRollingBack(batchID, result);
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

        (bytes32 processedStateRoot, Types.Result result) =
            massMigration.processMassMigrationCommit(
                previous.commitment.stateRoot,
                paramMaxTxsPerCommit,
                target.commitment.body,
                proofs
            );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startRollingBack(batchID, result);
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

        (bytes32 processedStateRoot, Types.Result result) =
            create2Transfer.processCreate2TransferCommit(
                previous.commitment.stateRoot,
                paramMaxTxsPerCommit,
                target.commitment.body.feeReceiver,
                target.commitment.body.txs,
                proofs
            );

        if (
            result != Types.Result.Ok ||
            (processedStateRoot != target.commitment.stateRoot)
        ) startRollingBack(batchID, result);
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
        Types.AuthCommon memory common =
            Types.AuthCommon({
                signature: target.commitment.body.signature,
                stateRoot: target.commitment.stateRoot,
                accountRoot: target.commitment.body.accountRoot,
                domain: domainSeparator(),
                txs: target.commitment.body.txs
            });
        Types.Result result = transfer.checkSignature(common, signatureProof);

        if (result != Types.Result.Ok) startRollingBack(batchID, result);
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
        Types.AuthCommon memory common =
            Types.AuthCommon({
                signature: target.commitment.body.signature,
                stateRoot: target.commitment.stateRoot,
                accountRoot: target.commitment.body.accountRoot,
                domain: domainSeparator(),
                txs: target.commitment.body.txs
            });

        Types.Result result =
            massMigration.checkSignature(
                common,
                signatureProof,
                target.commitment.body.spokeID
            );

        if (result != Types.Result.Ok) startRollingBack(batchID, result);
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
        Types.AuthCommon memory common =
            Types.AuthCommon({
                signature: target.commitment.body.signature,
                stateRoot: target.commitment.stateRoot,
                accountRoot: target.commitment.body.accountRoot,
                domain: domainSeparator(),
                txs: target.commitment.body.txs
            });

        Types.Result result =
            create2Transfer.checkSignature(common, signatureProof);

        if (result != Types.Result.Ok) startRollingBack(batchID, result);
    }
}
