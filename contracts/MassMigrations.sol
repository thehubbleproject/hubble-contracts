// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Transition } from "./libs/Transition.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { MerkleTree } from "./libs/MerkleTree.sol";
import { Authenticity } from "./libs/Authenticity.sol";

contract MassMigration {
    using SafeMath for uint256;
    using Tx for bytes;

    function checkSignature(
        Types.AuthCommon memory common,
        Types.SignatureProof memory proof,
        uint256 spokeID
    ) public view returns (Types.Result) {
        return Authenticity.verifyMassMigration(common, proof, spokeID);
    }

    /**
     * @notice processes the state transition of a commitment
     * @param previousStateRoot represents the state before the state transition
     * */
    function processMassMigrationCommit(
        bytes32 postStateRoot,
        bytes32 previousStateRoot,
        uint256 maxTxSize,
        Types.MassMigrationBody memory committed,
        Types.StateMerkleProof[] memory proofs
    ) public pure returns (Types.Result result) {
        if (committed.txs.massMigrationHasExcessData())
            return Types.Result.BadCompression;

        uint256 size = committed.txs.massMigrationSize();
        if (size > maxTxSize) return Types.Result.TooManyTx;

        Tx.MassMigration memory _tx;
        uint256 totalAmount = 0;
        uint256 fees = 0;
        bytes memory freshState = "";
        bytes32[] memory withdrawLeaves = new bytes32[](size);

        for (uint256 i = 0; i < size; i++) {
            _tx = committed.txs.massMigrationDecode(i);
            (previousStateRoot, freshState, result) = Transition
                .processMassMigration(
                previousStateRoot,
                _tx,
                committed.tokenID,
                proofs[i]
            );
            if (result != Types.Result.Ok) return result;

            // Only trust these variables when the result is good
            totalAmount += _tx.amount;
            fees += _tx.fee;
            withdrawLeaves[i] = keccak256(freshState);
        }
        (previousStateRoot, result) = Transition.processReceiver(
            previousStateRoot,
            committed.feeReceiver,
            committed.tokenID,
            fees,
            proofs[size]
        );
        if (result != Types.Result.Ok) return result;

        if (totalAmount != committed.amount)
            return Types.Result.MismatchedAmount;

        if (MerkleTree.merklize(withdrawLeaves) != committed.withdrawRoot)
            return Types.Result.BadWithdrawRoot;

        if (previousStateRoot != postStateRoot)
            return Types.Result.InvalidPostStateRoot;

        return result;
    }
}
