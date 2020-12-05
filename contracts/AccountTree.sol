pragma solidity ^0.5.15;

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

        // Fill the subtree
        for (uint256 i = 0; i < BATCH_DEPTH; i++) {
            uint256 n = (BATCH_DEPTH - i - 1);
            for (uint256 j = 0; j < 1 << n; j++) {
                uint256 k = j << 1;
                leafs[j] = keccak256(abi.encode(leafs[k], leafs[k + 1]));
            }
        }
        bytes32 leaf = leafs[0];

        // Ascend to the root
        uint256 path = leafIndexRight;
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
        leafIndexRight += 1;
        return leafIndexRight - 1;
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
