pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTreeLib as MTLib} from "./libs/MerkleTreeLib.sol";


contract IncrementalTree {
    MTLib mtLib;

    // The maximum tree depth
    uint8 internal constant MAX_DEPTH = 32;
    /* Structs */
    // A partial merkle tree which can be updated with new nodes, recomputing the root
    struct MerkleTree {
        // Root of the tree
        bytes32 root;
        // current height of the tree
        uint256 height;
        // Allows you to compute the path to the element (but it's not the path to
        // the elements). Caching these values is essential to efficient appends.
        bytes32[MAX_DEPTH] filledSubtrees;
    }

    // The number of inserted leaves
    uint256 internal nextLeafIndex = 0;

    constructor(address _mtLibAddress) public {
        mtLib = MTLib(_mtLibAddress);
        setMerkleRootAndHeight(mtLib.getZeroRoot(), mtLib.getMaxTreeDepth());
        for (uint8 i = 1; i < mtLib.getMaxTreeDepth(); i++) {
            tree.filledSubtrees[i] = mtLib.getRoot(0);
        }
    }

    MerkleTree public tree;

    /**
     * @notice Append leaf will append a leaf to the end of the tree
     * @return The sibling nodes along the way.
     */
    function appendLeaf(bytes32 _leaf) public returns (uint256) {
        uint256 currentIndex = nextLeafIndex;

        uint256 depth = uint256(tree.height);
        require(
            currentIndex < uint256(2)**depth,
            "IncrementalMerkleTree: tree is full"
        );

        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;
        for (uint8 i = 0; i < tree.height; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = mtLib.getRoot(i);
                tree.filledSubtrees[i] = currentLevelHash;
            } else {
                left = tree.filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = mtLib.getParent(left, right);
            currentIndex >>= 1;
        }
        tree.root = currentLevelHash;
        uint256 n;
        n = nextLeafIndex;
        nextLeafIndex += 1;
        return n;
    }

    /**
     * @notice Set the tree root and height of the stored tree
     * @param _root The merkle root of the tree
     * @param _height The height of the tree
     */
    function setMerkleRootAndHeight(bytes32 _root, uint256 _height) public {
        tree.root = _root;
        tree.height = _height;
    }

    function getTreeRoot() external view returns (bytes32) {
        return tree.root;
    }
}
