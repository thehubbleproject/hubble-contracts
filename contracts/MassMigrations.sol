pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Transition } from "./libs/Transition.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";

import { BLS } from "./libs/BLS.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { MerkleTree } from "./libs/MerkleTree.sol";
import { NameRegistry } from "./NameRegistry.sol";

contract MassMigration {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.UserState;

    function checkSignature(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        uint256 spokeID,
        bytes memory txs
    ) public view returns (Types.Result) {
        uint256 length = txs.massMigrationSize();
        uint256[2][] memory messages = new uint256[2][](length);
        for (uint256 i = 0; i < length; i++) {
            Tx.MassMigration memory _tx = txs.massMigrationDecode(i);
            // check state inclustion
            require(
                MerkleTree.verify(
                    stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Rollup: state inclusion signer"
            );

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.states[i].pubkeyIndex,
                    proof.pubkeyWitnesses[i]
                ),
                "Rollup: account does not exists"
            );

            // construct the message
            require(proof.states[i].nonce > 0, "Rollup: zero nonce");
            bytes memory txMsg = Tx.massMigrationMessageOf(
                _tx,
                proof.states[i].nonce - 1,
                spokeID
            );
            // make the message
            messages[i] = BLS.hashToPoint(domain, txMsg);
        }
        if (!BLS.verifyMultiple(signature, proof.pubkeys, messages)) {
            return Types.Result.BadSignature;
        }
        return Types.Result.Ok;
    }

    /**
     * @notice processes the state transition of a commitment
     * @param stateRoot represents the state before the state transition
     * */
    function processMassMigrationCommit(
        bytes32 stateRoot,
        Types.MassMigrationBody memory commitmentBody,
        Types.StateMerkleProof[] memory proofs
    ) public view returns (bytes32, Types.Result result) {
        uint256 length = commitmentBody.txs.massMigrationSize();
        Tx.MassMigration memory _tx;
        uint256 totalAmount = 0;
        uint256 fees = 0;
        bytes memory freshState = "";
        bytes32[] memory withdrawLeaves = new bytes32[](length);

        for (uint256 i = 0; i < length; i++) {
            _tx = commitmentBody.txs.massMigrationDecode(i);
            (stateRoot, freshState, result) = Transition.processMassMigration(
                stateRoot,
                _tx,
                commitmentBody.tokenID,
                proofs[i]
            );
            if (result != Types.Result.Ok) return (stateRoot, result);

            // Only trust these variables when the result is good
            totalAmount += _tx.amount;
            fees += _tx.fee;
            withdrawLeaves[i] = keccak256(freshState);
        }
        (stateRoot, result) = Transition.processReceiver(
            stateRoot,
            commitmentBody.feeReceiver,
            commitmentBody.tokenID,
            fees,
            proofs[length]
        );
        if (result != Types.Result.Ok) return (stateRoot, result);

        if (totalAmount != commitmentBody.amount)
            return (stateRoot, Types.Result.MismatchedAmount);

        if (MerkleTree.merklise(withdrawLeaves) != commitmentBody.withdrawRoot)
            return (stateRoot, Types.Result.BadWithdrawRoot);

        return (stateRoot, result);
    }
}
