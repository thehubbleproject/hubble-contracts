pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { MerkleTreeUtilsLib, MerkleTreeUtils } from "../MerkleTreeUtils.sol";

contract TestMerkleTree is MerkleTreeUtils {
    constructor(uint256 maxDepth) public MerkleTreeUtils(maxDepth) {}

    function testVerify(
        bytes32 root,
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witnesses
    ) public returns (bool, uint256) {
        uint256 gasCost = gasleft();
        bool result = MerkleTreeUtilsLib.verifyLeaf(
            root,
            leaf,
            path,
            witnesses
        );
        return (result, gasCost - gasleft());
    }

    function testIsLast(
        bytes32 root,
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witnesses
    ) public returns (bool, uint256) {
        uint256 gasCost = gasleft();
        bool result = isLast(root, leaf, path, witnesses);
        return (result, gasCost - gasleft());
    }
}
