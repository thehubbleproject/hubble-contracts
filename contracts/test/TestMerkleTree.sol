pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { MerkleTree, MerkleTreeUtils } from "../MerkleTreeUtils.sol";

contract TestMerkleTree is MerkleTreeUtils {
    constructor(uint256 maxDepth) public MerkleTreeUtils(maxDepth) {}

    function testVerify(
        bytes32 root,
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witness
    ) public returns (bool, uint256) {
        uint256 gasCost = gasleft();
        bool result = MerkleTree.verify(root, leaf, path, witness);
        return (result, gasCost - gasleft());
    }

    function testGetMerkleRootFromLeaves(bytes32[] memory nodes)
        public
        returns (bytes32, uint256)
    {
        uint256 gasCost = gasleft();
        bytes32 root = MerkleTree.merklise(nodes);
        return (root, gasCost - gasleft());
    }

    function testGetRoot(uint256 level) public returns (bytes32, uint256) {
        uint256 gasCost = gasleft();
        bytes32 root = getRoot(level);
        return (root, gasCost - gasleft());
    }

    function testGetRoot2(uint256 level) public returns (bytes32, uint256) {
        uint256 gasCost = gasleft();
        bytes32 root = MerkleTree.getRoot(level);
        return (root, gasCost - gasleft());
    }
}
