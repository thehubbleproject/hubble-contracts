pragma solidity ^0.5.15;

import {AccountTree} from "./AccountTree.sol";
import {BLS} from "./libs/BLS.sol";

contract BLSAccountRegistry is AccountTree {
    constructor() public AccountTree() {}

    function register(uint256[4] calldata pubkey) external returns (uint256) {
        require(
            BLS.isValidPublicKey(pubkey),
            "BLSAccountTree: invalid pub key"
        );
        bytes32 leaf = keccak256(abi.encodePacked(pubkey));
        uint256 accountID = _updateSingle(leaf);
        return accountID;
    }

    function registerBatch(uint256[4][BATCH_SIZE] calldata pubkeys)
        external
        returns (uint256)
    {
        bytes32[BATCH_SIZE] memory leafs;
        for (uint256 i = 0; i < BATCH_SIZE; i++) {
            require(
                BLS.isValidPublicKey(pubkeys[i]),
                "BLSAccountTree: invalid pub key"
            );
            bytes32 leaf = keccak256(abi.encodePacked(pubkeys[i]));
            leafs[i] = leaf;
        }
        uint256 lowerOffset = _updateBatch(leafs);
        return lowerOffset;
    }

    function exists(
        uint256 accountIndex,
        uint256[4] calldata pubkey,
        bytes32[WITNESS_LENGTH] calldata witness
    ) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(pubkey));
        return _checkInclusion(leaf, accountIndex, witness);
    }
}
