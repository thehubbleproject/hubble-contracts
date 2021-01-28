// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

/**
    @notice The account tree is a `DEPTH + 1` Merkle tree of public keys.
    It has a left tree and a right tree with both depth `DEPTH`.
    To insert a single public key the account tree insert to the left tree.
    To insert many public keys in one on chain transaction it insert to the right tree.
 */
contract AccountTree {
    uint256 public constant DEPTH = 31;
    uint256 public constant WITNESS_LENGTH = DEPTH;
    uint256 public constant SET_SIZE = 1 << DEPTH;
    uint256 public constant BATCH_DEPTH = 4;
    uint256 public constant BATCH_SIZE = 1 << BATCH_DEPTH;

    bytes32 public rootLeft;
    bytes32 public rootRight;
    bytes32 public root;
    uint256 public leafIndexLeft = 0;
    uint256 public leafIndexRight = 0;

    bytes32[DEPTH] public zeros;
    bytes32[DEPTH] public filledSubtreesLeft;
    bytes32[DEPTH - BATCH_DEPTH] public filledSubtreesRight;

    constructor() public {
        for (uint256 i = 1; i < DEPTH; i++) {
            zeros[i] = keccak256(abi.encode(zeros[i - 1], zeros[i - 1]));
            if (DEPTH > i) {
                filledSubtreesLeft[i] = zeros[i];
            }
            if (BATCH_DEPTH <= i && DEPTH > i) {
                filledSubtreesRight[i - BATCH_DEPTH] = zeros[i];
            }
        }

        rootLeft = keccak256(abi.encode(zeros[DEPTH - 1], zeros[DEPTH - 1]));
        rootRight = keccak256(abi.encode(zeros[DEPTH - 1], zeros[DEPTH - 1]));
        root = keccak256(abi.encode(rootLeft, rootRight));
    }

    function _updateSingle(bytes32 leafInput) internal returns (uint256) {
        require(leafIndexLeft < SET_SIZE - 1, "AccountTree: left set is full ");
        bytes32 leaf = leafInput;
        uint256 path = leafIndexLeft;
        bool subtreeSet = false;
        for (uint256 i = 0; i < DEPTH; i++) {
            if (path & 1 == 1) {
                leaf = keccak256(abi.encode(filledSubtreesLeft[i], leaf));
            } else {
                if (!subtreeSet) {
                    filledSubtreesLeft[i] = leaf;
                    subtreeSet = true;
                }
                leaf = keccak256(abi.encode(leaf, zeros[i]));
            }
            path >>= 1;
        }
        rootLeft = leaf;
        root = keccak256(abi.encode(rootLeft, rootRight));
        leafIndexLeft += 1;
        return leafIndexLeft - 1;
    }

    function _updateBatch(bytes32[BATCH_SIZE] memory leafs)
        internal
        returns (uint256)
    {
        require(
            leafIndexRight < SET_SIZE - 1 - BATCH_SIZE,
            "AccountTree: right set is full "
        );

        bytes32[BATCH_SIZE / 2] memory buf;

        // i = 0
        for (uint256 j = 0; j < 1 << (BATCH_DEPTH - 1); j++) {
            uint256 k = j << 1;
            buf[j] = keccak256(abi.encode(leafs[k], leafs[k + 1]));
        }

        // i > 0
        for (uint256 i = 1; i < BATCH_DEPTH; i++) {
            uint256 n = 1 << (BATCH_DEPTH - i - 1);
            for (uint256 j = 0; j < n; j++) {
                uint256 k = j << 1;
                buf[j] = keccak256(abi.encode(buf[k], buf[k + 1]));
            }
        }
        bytes32 leaf = buf[0];

        // Ascend to the root
        uint256 path = leafIndexRight / BATCH_SIZE;
        bool subtreeSet = false;
        for (uint256 i = 0; i < DEPTH - BATCH_DEPTH; i++) {
            if (path & 1 == 1) {
                leaf = keccak256(abi.encode(filledSubtreesRight[i], leaf));
            } else {
                if (!subtreeSet) {
                    filledSubtreesRight[i] = leaf;
                    subtreeSet = true;
                }
                leaf = keccak256(abi.encode(leaf, zeros[i + BATCH_DEPTH]));
            }
            path >>= 1;
        }
        rootRight = leaf;
        root = keccak256(abi.encode(rootLeft, rootRight));
        leafIndexRight += BATCH_SIZE;
        return leafIndexRight - BATCH_SIZE;
    }

    function _checkInclusion(
        bytes32 leafInput,
        uint256 leafIndex,
        bytes32[WITNESS_LENGTH] memory witness
    ) internal view returns (bool) {
        require(witness.length == DEPTH, "AccountTree: invalid witness size");
        uint256 path = leafIndex % SET_SIZE;
        bytes32 leaf = leafInput;
        for (uint256 i = 0; i < WITNESS_LENGTH; i++) {
            if (path & 1 == 1) {
                leaf = keccak256(abi.encode(witness[i], leaf));
            } else {
                leaf = keccak256(abi.encode(leaf, witness[i]));
            }
            path >>= 1;
        }
        if (leafIndex < SET_SIZE) {
            return leaf == rootLeft;
        } else {
            return leaf == rootRight;
        }
    }
}
