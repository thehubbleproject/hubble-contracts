pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { MerkleProof, MerkleTreeUtils } from "../MerkleTreeUtils.sol";

contract TestMerkleTree is MerkleTreeUtils {
    constructor(uint256 maxDepth) public MerkleTreeUtils(maxDepth) {}

    function testVerify(
        bytes32 root,
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witness
    ) public returns (bool, uint256) {
        uint256 gasCost = gasleft();
        bool result = MerkleProof.verify(root, leaf, path, witness);
        return (result, gasCost - gasleft());
    }

    function testGetMerkleRootFromLeaves(bytes32[] memory nodes)
        public
        returns (bytes32, uint256)
    {
        uint256 gasCost = gasleft();
        bytes32 root = MerkleProof.merklise(nodes);
        return (root, gasCost - gasleft());
    }

    function testGetRoot(uint256 level) public returns (bytes32, uint256) {
        uint256 gasCost = gasleft();
        bytes32 root = getRoot(level);
        return (root, gasCost - gasleft());
    }

    function testGetRoot2(uint256 level) public returns (bytes32, uint256) {
        uint256 gasCost = gasleft();
        bytes32 root = MerkleProof.getRoot(level);
        return (root, gasCost - gasleft());
    }
}
