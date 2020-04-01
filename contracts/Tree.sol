pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;
import {MerkleTreeLib as MTLib} from "./libs/MerkleTreeLib.sol";


/*
 * Merkle Tree Utilities for Rollup
 */
contract Tree {
    MTLib MerkleLib;
    /* Structs */
    // A partial merkle tree which can be updated with new nodes, recomputing the root
    struct MerkleTree {
        // The root
        bytes32 root;
        uint256 height;
        mapping(bytes32 => bytes32) nodes;
    }

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
     * @notice Update the stored tree / root with a particular dataBlock at some path (no siblings needed)
     * @param _dataBlock The data block we're storing/verifying
     * @param _path The path from the leaf to the root / the index of the leaf.
     */
    function update(bytes memory _dataBlock, uint256 _path) public {
        bytes32[] memory siblings = getSiblings(_path);
        store(_dataBlock, _path, siblings);
    }

    /**
     * @notice Update the stored tree / root with a particular leaf hash at some path (no siblings needed)
     * @param _leaf The leaf we're storing/verifying
     *   @param _path The path from the leaf to the root / the index of the leaf.
     */
    function updateLeaf(bytes32 _leaf, uint256 _path) public {
        bytes32[] memory siblings = getSiblings(_path);
        storeLeaf(_leaf, _path, siblings);
    }

    /**
     * @notice Store a particular merkle proof & verify that the root did not change.
     * @param _dataBlock The data block we're storing/verifying
     * @param _path The path from the leaf to the root / the index of the leaf.
     * @param _siblings The sibling nodes along the way.
     */
    function verifyAndStore(
        bytes memory _dataBlock,
        uint256 _path,
        bytes32[] memory _siblings
    ) public {
        bytes32 oldRoot = tree.root;
        store(_dataBlock, _path, _siblings);
        require(tree.root == oldRoot, "Failed same root verification check!");
    }

    /**
     * @notice Store a particular dataBlock & its intermediate nodes in the tree
     * @param _dataBlock The data block we're storing.
     * @param _path The path from the leaf to the root / the index of the leaf.
     * @param _siblings The sibling nodes along the way.
     */
    function store(
        bytes memory _dataBlock,
        uint256 _path,
        bytes32[] memory _siblings
    ) public {
        // Compute the leaf node & store the leaf
        bytes32 leaf = keccak256(_dataBlock);
        storeLeaf(leaf, _path, _siblings);
    }

    /**
     * @notice Store a particular leaf hash & its intermediate nodes in the tree
     * @param _leaf The leaf we're storing.
     * @param _path The path from the leaf to the root / the index of the leaf.
     * @param _siblings The sibling nodes along the way.
     */
    function storeLeaf(bytes32 _leaf, uint256 _path, bytes32[] memory _siblings)
        public
    {
        // First compute the leaf node
        bytes32 computedNode = _leaf;
        for (uint256 i = 0; i < _siblings.length; i++) {
            bytes32 parent;
            bytes32 sibling = _siblings[i];
            uint8 isComputedRightSibling = MerkleLib.getNthBitFromRight(
                _path,
                i
            );
            if (isComputedRightSibling == 0) {
                parent = MerkleLib.getParent(computedNode, sibling);
                // Store the node!
                storeNode(parent, computedNode, sibling);
            } else {
                parent = MerkleLib.getParent(sibling, computedNode);
                // Store the node!
                storeNode(parent, sibling, computedNode);
            }
            computedNode = parent;
        }
        // Store the new root
        tree.root = computedNode;
    }

    /**
     * @notice Get siblings for a leaf at a particular index of the tree.
     *         This is used for updates which don't include sibling nodes.
     * @param _path The path from the leaf to the root / the index of the leaf.
     * @return The sibling nodes along the way.
     */
    function getSiblings(uint256 _path) public view returns (bytes32[] memory) {
        bytes32[] memory siblings = new bytes32[](tree.height);
        bytes32 computedNode = tree.root;
        for (uint256 i = tree.height; i > 0; i--) {
            uint256 siblingIndex = i - 1;
            (bytes32 leftChild, bytes32 rightChild) = getChildren(computedNode);
            if (MerkleLib.getNthBitFromRight(_path, siblingIndex) == 0) {
                computedNode = leftChild;
                siblings[siblingIndex] = rightChild;
            } else {
                computedNode = rightChild;
                siblings[siblingIndex] = leftChild;
            }
        }
        // Now store everything
        return siblings;
    }

    /*********************
     * Utility Functions *
     ********************/
    /**
     * @notice Get our stored tree's root
     * @return The merkle root of the tree
     */
    function getRoot() public view returns (bytes32) {
        return tree.root;
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

    /**
     * @notice Store node in the (in-storage) merkle tree
     * @param _parent The parent node
     * @param _leftChild The left child of the parent in the tree
     * @param _rightChild The right child of the parent in the tree
     */
    function storeNode(bytes32 _parent, bytes32 _leftChild, bytes32 _rightChild)
        public
    {
        tree.nodes[MerkleLib.getLeftSiblingKey(_parent)] = _leftChild;
        tree.nodes[MerkleLib.getRightSiblingKey(_parent)] = _rightChild;
    }

    /**
     * @notice Get the children of some parent in the tree
     * @param _parent The parent node
     * @return (rightChild, leftChild) -- the two children of the parent
     */
    function getChildren(bytes32 _parent)
        public
        view
        returns (bytes32, bytes32)
    {
        return (
            tree.nodes[MerkleLib.getLeftSiblingKey(_parent)],
            tree.nodes[MerkleLib.getRightSiblingKey(_parent)]
        );
    }
}
