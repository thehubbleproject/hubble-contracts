// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import { AccountTree } from "./AccountTree.sol";
import { BLS } from "./libs/BLS.sol";

/**
    @dev For gas efficiency reason, public key itself is not logged in events but is
    expected to be parsed from the calldata.
 */
contract BLSAccountRegistry is AccountTree {
    event SinglePubkeyRegistered(uint256 pubkeyID);
    event BatchPubkeyRegistered(uint256 startID, uint256 endID);

    modifier noInternalTransactions() {
        require(
            msg.sender == tx.origin,
            "BLSAccountRegistry: Internal transactions are forbidden"
        );
        _;
    }

    function register(uint256[4] calldata pubkey)
        external
        noInternalTransactions
        returns (uint256)
    {
        bytes32 leaf = keccak256(abi.encodePacked(pubkey));
        uint256 pubkeyID = _updateSingle(leaf);
        emit SinglePubkeyRegistered(pubkeyID);
        return pubkeyID;
    }

    function registerBatch(uint256[4][BATCH_SIZE] calldata pubkeys)
        external
        noInternalTransactions
        returns (uint256)
    {
        bytes32[BATCH_SIZE] memory leafs;
        for (uint256 i = 0; i < BATCH_SIZE; i++) {
            bytes32 leaf = keccak256(abi.encodePacked(pubkeys[i]));
            leafs[i] = leaf;
        }
        uint256 lowerOffset = _updateBatch(leafs);
        emit BatchPubkeyRegistered(lowerOffset, lowerOffset + BATCH_SIZE - 1);
        return lowerOffset;
    }

    function exists(
        uint256 pubkeyID,
        uint256[4] calldata pubkey,
        bytes32[WITNESS_LENGTH] calldata witness
    ) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(pubkey));
        return _checkInclusion(leaf, pubkeyID, witness);
    }
}
