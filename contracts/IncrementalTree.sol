pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTreeLib as MTLib} from "./libs/MerkleTreeLib.sol";


contract IncrementalTree {
    bytes32[] public defaultHashes = new bytes32[](160);
    MTLib MerkleLib;
    /* Structs */
    // A partial merkle tree which can be updated with new nodes, recomputing the root
    struct MerkleTree {
        // Root of the tree
        bytes32 root;
        // current height of the tree
        uint256 height;
        // Allows you to compute the path to the element (but it's not the path to
        // the elements). Caching these values is essential to efficient appends.
        bytes32[] filledSubtrees;
    }

    // The number of inserted leaves
    uint256 internal nextLeafIndex = 0;

    constructor(address _mtLibAddress) public {
        MerkleLib = MTLib(_mtLibAddress);
        setMerkleRootAndHeight(
            MerkleLib.getZeroRoot(),
            MerkleLib.getMaxTreeDepth()
        );
    }

    // A tree which is used in `update()` and `store()`
    MerkleTree public tree;

    /**
     * @notice Append leaf will append a leaf to the end of the tree
     * @return The sibling nodes along the way.
     */
    function appendLeaf(bytes32 _leaf) public returns (bytes32) {
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
            // if current_index is 5, for instance, over the iterations it will
            // look like this: 5, 2, 1, 0, 0, 0 ...

            if (currentIndex % 2 == 0) {
                // For later values of `i`, use the previous hash as `left`, and
                // the (hashed) zero value for `right`
                left = currentLevelHash;
                right = defaultHashes[i];

                tree.filledSubtrees[i] = currentLevelHash;
            } else {
                left = tree.filledSubtrees[i];
                right = currentLevelHash;
            }

            currentLevelHash = MerkleLib.getParent(left, right);

            // equivalent to currentIndex /= 2;
            currentIndex >>= 1;
        }

        tree.root = currentLevelHash;

        nextLeafIndex += 1;
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
}
