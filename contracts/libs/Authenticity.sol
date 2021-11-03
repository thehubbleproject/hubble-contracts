// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Types } from "./Types.sol";
import { MerkleTree } from "../libs/MerkleTree.sol";
import { Tx } from "./Tx.sol";
import { BLS } from "./BLS.sol";

/**
    @notice methods in this libaray recover messages from the transactions and check
    if those are signed by the senders.
 */
library Authenticity {
    using Tx for bytes;
    using Types for Types.UserState;

    bytes32 public constant ZERO_BYTES32 =
        0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    function verifyTransfer(
        Types.AuthCommon memory common,
        Types.SignatureProof memory proof
    ) internal view returns (Types.Result) {
        uint256 size = common.txs.transferSize();
        uint256[2][] memory messages = new uint256[2][](size);
        uint256[] memory senders = new uint256[](size);
        // We reverse loop the transactions to compute nonce correctly
        for (uint256 j = 0; j < size; j++) {
            // i is the index counting down from tail
            uint256 i = size - j - 1;
            Tx.Transfer memory _tx = common.txs.transferDecode(i);
            // check state inclusion
            require(
                MerkleTree.verify(
                    common.stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Authenticity: state inclusion signer"
            );
            require(proof.states[i].nonce > 0, "Authenticity: zero nonce");

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    common.accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.states[i].pubkeyID,
                    proof.pubkeyWitnesses[i]
                ),
                "Authenticity: account does not exists"
            );
            uint256 nonce = proof.states[i].nonce - 1;
            // Add a huge value to avoid collision to the array initial value 0
            uint256 safeIndex = _tx.fromIndex + 1000000000000000;

            for (uint256 k = 0; k < j; k++) {
                // Update nonce if the sender is seen before
                if (senders[k] == safeIndex) nonce--;
            }
            senders[j] = safeIndex;
            // construct the message
            bytes memory txMsg = Tx.transferMessageOf(_tx, nonce);
            messages[i] = BLS.hashToPoint(common.domain, txMsg);
        }
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            common.signature,
            proof.pubkeys,
            messages
        );
        if (!callSuccess) {
            return Types.Result.BadPrecompileCall;
        }
        if (!checkSuccess) {
            return Types.Result.BadSignature;
        }
        return Types.Result.Ok;
    }

    function verifyMassMigration(
        Types.AuthCommon memory common,
        Types.SignatureProof memory proof,
        uint256 spokeID
    ) internal view returns (Types.Result) {
        uint256 size = common.txs.massMigrationSize();
        uint256[2][] memory messages = new uint256[2][](size);
        uint256[] memory senders = new uint256[](size);
        for (uint256 j = 0; j < size; j++) {
            uint256 i = size - j - 1;
            Tx.MassMigration memory _tx = common.txs.massMigrationDecode(i);
            // check state inclusion
            require(
                MerkleTree.verify(
                    common.stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Authenticity: state inclusion signer"
            );
            require(proof.states[i].nonce > 0, "Authenticity: zero nonce");

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    common.accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.states[i].pubkeyID,
                    proof.pubkeyWitnesses[i]
                ),
                "Authenticity: account does not exists"
            );

            uint256 nonce = proof.states[i].nonce - 1;
            uint256 safeIndex = _tx.fromIndex + 1000000000000000;

            for (uint256 k = 0; k < j; k++) {
                if (senders[k] == safeIndex) nonce--;
            }
            senders[j] = safeIndex;
            bytes memory txMsg = Tx.massMigrationMessageOf(_tx, nonce, spokeID);
            messages[i] = BLS.hashToPoint(common.domain, txMsg);
        }
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            common.signature,
            proof.pubkeys,
            messages
        );
        if (!callSuccess) {
            return Types.Result.BadPrecompileCall;
        }
        if (!checkSuccess) {
            return Types.Result.BadSignature;
        }

        return Types.Result.Ok;
    }

    function verifyCreate2Transfer(
        Types.AuthCommon memory common,
        Types.SignatureProofWithReceiver memory proof
    ) internal view returns (Types.Result) {
        uint256 size = common.txs.create2TransferSize();
        uint256[2][] memory messages = new uint256[2][](size);
        uint256[] memory senders = new uint256[](size);
        for (uint256 j = 0; j < size; j++) {
            uint256 i = size - j - 1;
            Tx.Create2Transfer memory _tx = common.txs.create2TransferDecode(i);

            // check state inclusion
            require(
                MerkleTree.verify(
                    common.stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Authenticity: state inclusion signer"
            );
            require(proof.states[i].nonce > 0, "Authenticity: zero nonce");

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    common.accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeysSender[i])),
                    proof.states[i].pubkeyID,
                    proof.pubkeyWitnessesSender[i]
                ),
                "Authenticity: from account does not exists"
            );

            // check receiver pubkey inclusion at committed accID
            require(
                MerkleTree.verify(
                    common.accountRoot,
                    proof.pubkeyHashesReceiver[i],
                    _tx.toPubkeyID,
                    proof.pubkeyWitnessesReceiver[i]
                ),
                "Authenticity: to account does not exists"
            );

            if (proof.pubkeyHashesReceiver[i] == ZERO_BYTES32) {
                return Types.Result.NonexistentReceiver;
            }

            // construct the message

            uint256 nonce = proof.states[i].nonce - 1;
            uint256 safeIndex = _tx.fromIndex + 1000000000000000;

            for (uint256 k = 0; k < j; k++) {
                if (senders[k] == safeIndex) nonce--;
            }
            senders[j] = safeIndex;
            bytes memory txMsg =
                Tx.create2TransferMessageOf(
                    _tx,
                    nonce,
                    proof.pubkeyHashesReceiver[i]
                );

            messages[i] = BLS.hashToPoint(common.domain, txMsg);
        }
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            common.signature,
            proof.pubkeysSender,
            messages
        );
        if (!callSuccess) {
            return Types.Result.BadPrecompileCall;
        }
        if (!checkSuccess) {
            return Types.Result.BadSignature;
        }
        return Types.Result.Ok;
    }
}
