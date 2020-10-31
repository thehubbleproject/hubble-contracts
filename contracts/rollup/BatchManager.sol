pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Types } from "../libs/Types.sol";

import { MerkleTree } from "../libs/MerkleTree.sol";

contract BatchManager {
    using Types for Types.Batch;
    using Types for Types.Commitment;
    using Types for Types.TransferCommitment;
    using Types for Types.MassMigrationCommitment;

    Types.Batch[] public batches;

    // Non-zero means a rollback is in progress
    uint256 public invalidBatchMarker;

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
            "Already finalised"
        );

        require(
            batchID < invalidBatchMarker || invalidBatchMarker == 0,
            "Rollback in process"
        );
        _;
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

    function numOfBatchesSubmitted() external view returns (uint256) {
        return batches.length;
    }

    function getBatch(uint256 batchID)
        external
        view
        returns (Types.Batch memory batch)
    {
        require(batches.length - 1 >= batchID, "Invalid batchID");
        return batches[batchID];
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
}
