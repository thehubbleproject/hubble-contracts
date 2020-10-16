pragma solidity ^0.5.15;
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
        uint256 targetSpokeID,
        bytes memory txs
    ) public view returns (uint256 gasCost, Types.Result result) {
        gasCost = gasleft();
        result = checkSignature(
            signature,
            proof,
            stateRoot,
            accountRoot,
            domain,
            targetSpokeID,
            txs
        );
        gasCost = gasCost - gasleft();
    }

    function testProcessMassMigrationCommit(
        bytes32 stateRoot,
        Types.MassMigrationBody memory commitmentBody,
        Types.StateMerkleProof[] memory proofs
    )
        public
        view
        returns (
            uint256 gasCost,
            bytes32,
            Types.Result
        )
    {
        gasCost = gasleft();
        (bytes32 postRoot, Types.Result result) = processMassMigrationCommit(
            stateRoot,
            commitmentBody,
            proofs
        );
        return (gasCost - gasleft(), postRoot, result);
    }
}
