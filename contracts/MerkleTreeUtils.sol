pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

library MerkleTreeUtilsLib {
    function rootFromWitnesses(
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witnesses
    ) internal pure returns (bytes32) {
        for (uint256 i = 0; i < witnesses.length; i++) {
            // get i-th bit from right
            if (((path >> i) & 1) == 0) {
                leaf = keccak256(abi.encode(leaf, witnesses[i]));
            } else {
                leaf = keccak256(abi.encode(witnesses[i], leaf));
            }
        }
        return leaf;
    }

    function verifyLeaf(
        bytes32 root,
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witnesses
    ) internal pure returns (bool) {
        return rootFromWitnesses(leaf, path, witnesses) == root;
    }
}

contract MerkleTreeUtils {
    // The default hashes
    bytes32[] public defaultHashes;
    uint256 public MAX_DEPTH;

    /**
     * @notice Initialize a new MerkleTree contract, computing the default hashes for the merkle tree (MT)
     */
    constructor(uint256 maxDepth) public {
        MAX_DEPTH = maxDepth;
        defaultHashes = new bytes32[](MAX_DEPTH);
        // Calculate & set the default hashes
        setDefaultHashes(MAX_DEPTH);
    }

    /* Methods */

    /**
     * @notice Set default hashes
     */
    function setDefaultHashes(uint256 depth) internal {
        // Set the initial default hash.
        defaultHashes[0] = keccak256(abi.encode(0));
        for (uint256 i = 1; i < depth; i++) {
            defaultHashes[i] = keccak256(
                abi.encode(defaultHashes[i - 1], defaultHashes[i - 1])
            );
        }
    }

    function getZeroRoot() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    defaultHashes[MAX_DEPTH - 1],
                    defaultHashes[MAX_DEPTH - 1]
                )
            );
    }

    function getMaxTreeDepth() public view returns (uint256) {
        return MAX_DEPTH;
    }

    function getRoot(uint256 index) public view returns (bytes32) {
        return defaultHashes[index];
    }

    function getDefaultHashAtLevel(uint256 index)
        public
        view
        returns (bytes32)
    {
        return defaultHashes[index];
    }

    /**
     * @notice Get the merkle root computed from some set of data blocks.
     * @param _dataBlocks The data being used to generate the tree.
     * @return the merkle tree root
     * NOTE: This is a stateless operation
     */
    function getMerkleRoot(bytes[] calldata _dataBlocks)
        external
        view
        returns (bytes32)
    {
        bytes32[] memory nodes = new bytes32[](_dataBlocks.length); // Add one in case we have an odd number of leaves
        // Generate the leaves
        for (uint256 i = 0; i < _dataBlocks.length; i++) {
            nodes[i] = keccak256(_dataBlocks[i]);
        }
        return getMerkleRootFromLeaves(nodes);
    }

    /**
     * @notice Get the merkle root computed from some set of data blocks.
     * @param nodes The data being used to generate the tree.
     * @return the merkle tree root
     * NOTE: This is a stateless operation
     */
    function getMerkleRootFromLeaves(bytes32[] memory nodes)
        public
        view
        returns (bytes32)
    {
        uint256 odd = nodes.length & 1;
        uint256 n = (nodes.length + 1) >> 1;
        uint256 level = 0;
        while (true) {
            uint256 i = 0;
            for (; i < n - odd; i++) {
                uint256 j = i << 1;
                nodes[i] = keccak256(abi.encode(nodes[j], nodes[j + 1]));
            }
            if (odd == 1) {
                nodes[i] = keccak256(
                    abi.encode(nodes[i << 1], defaultHashes[level])
                );
            }
            if (n == 1) {
                break;
            }
            odd = (n & 1);
            n = (n + 1) >> 1;
            level += 1;
        }
        return nodes[0];
    }

    /**
     * @notice Verify an inclusion proof.
     * @param _root The root of the tree we are verifying inclusion for.
     * @param _leaf The data block we're verifying inclusion for.
     * @param _path The path from the leaf to the root.
     * @param _siblings The sibling nodes along the way.
     * @return The next level of the tree
     * NOTE: This is a stateless operation
     */
    function verifyLeaf(
        bytes32 _root,
        bytes32 _leaf,
        uint256 _path,
        bytes32[] memory _siblings
    ) public pure returns (bool) {
        return MerkleTreeUtilsLib.verifyLeaf(_root, _leaf, _path, _siblings);
    }

    /**
     * @notice Update a leaf using siblings and root
     *         This is a stateless operation
     * @param _leaf The leaf we're updating.
     * @param _path The path from the leaf to the root / the index of the leaf.
     * @param _siblings The sibling nodes along the way.
     * @return Updated root
     */
    function updateLeafWithSiblings(
        bytes32 _leaf,
        uint256 _path,
        bytes32[] memory _siblings
    ) public pure returns (bytes32) {
        return MerkleTreeUtilsLib.rootFromWitnesses(_leaf, _path, _siblings);
    }
}
