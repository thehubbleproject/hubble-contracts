// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { MassMigration } from "../MassMigrations.sol";
import { Types } from "../libs/Types.sol";

contract TestMassMigration is MassMigration {
    function testCheckSignature(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        uint256 spokeID,
        bytes memory txs
    ) public view returns (uint256 gasCost, Types.Result result) {
        gasCost = gasleft();
        Types.AuthCommon memory common =
            Types.AuthCommon({
                signature: signature,
                stateRoot: stateRoot,
                accountRoot: accountRoot,
                domain: domain,
                txs: txs
            });
        result = checkSignature(common, proof, spokeID);
        gasCost = gasCost - gasleft();
    }

    function testProcessMassMigrationCommit(
        bytes32 currentStateRoot,
        bytes32 postStateRoot,
        uint256 maxTxSize,
        Types.MassMigrationBody memory commitmentBody,
        Types.StateMerkleProof[] memory proofs
    ) public view returns (uint256 gasCost, Types.Result) {
        gasCost = gasleft();
        Types.Result result =
            processMassMigrationCommit(
                currentStateRoot,
                postStateRoot,
                maxTxSize,
                commitmentBody,
                proofs
            );
        return (gasCost - gasleft(), result);
    }
}
