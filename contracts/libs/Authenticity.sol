pragma solidity ^0.5.15;
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

    function verifyTransfer(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) internal view returns (Types.Result) {
        uint256 size = txs.transferSize();
        uint256[2][] memory messages = new uint256[2][](size);
        for (uint256 i = 0; i < size; i++) {
            Tx.Transfer memory _tx = txs.transferDecode(i);
            // check state inclusion
            require(
                MerkleTree.verify(
                    stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Authenticity: state inclusion signer"
            );

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.states[i].pubkeyID,
                    proof.pubkeyWitnesses[i]
                ),
                "Authenticity: account does not exists"
            );

            // construct the message
            require(proof.states[i].nonce > 0, "Authenticity: zero nonce");
            bytes memory txMsg = Tx.transferMessageOf(
                _tx,
                proof.states[i].nonce - 1
            );
            messages[i] = BLS.hashToPoint(domain, txMsg);
        }
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            signature,
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
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        uint256 spokeID,
        bytes memory txs
    ) internal view returns (Types.Result) {
        uint256 size = txs.massMigrationSize();
        uint256[2][] memory messages = new uint256[2][](size);
        for (uint256 i = 0; i < size; i++) {
            Tx.MassMigration memory _tx = txs.massMigrationDecode(i);
            // check state inclusion
            require(
                MerkleTree.verify(
                    stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Authenticity: state inclusion signer"
            );

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.states[i].pubkeyID,
                    proof.pubkeyWitnesses[i]
                ),
                "Authenticity: account does not exists"
            );

            // construct the message
            require(proof.states[i].nonce > 0, "Authenticity: zero nonce");
            bytes memory txMsg = Tx.massMigrationMessageOf(
                _tx,
                proof.states[i].nonce - 1,
                spokeID
            );
            messages[i] = BLS.hashToPoint(domain, txMsg);
        }
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            signature,
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
        uint256[2] memory signature,
        Types.SignatureProofWithReceiver memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) internal view returns (Types.Result) {
        uint256 size = txs.create2TransferSize();
        uint256[2][] memory messages = new uint256[2][](size);
        for (uint256 i = 0; i < size; i++) {
            Tx.Create2Transfer memory _tx = txs.create2TransferDecode(i);

            // check state inclusion
            require(
                MerkleTree.verify(
                    stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Authenticity: state inclusion signer"
            );

            // check pubkey inclusion
            require(
                MerkleTree.verify(
                    accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeysSender[i])),
                    proof.states[i].pubkeyID,
                    proof.pubkeyWitnessesSender[i]
                ),
                "Authenticity: from account does not exists"
            );

            // check receiver pubkey inclusion at committed accID
            require(
                MerkleTree.verify(
                    accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeysReceiver[i])),
                    _tx.toPubkeyID,
                    proof.pubkeyWitnessesReceiver[i]
                ),
                "Authenticity: to account does not exists"
            );

            // construct the message
            require(proof.states[i].nonce > 0, "Authenticity: zero nonce");

            bytes memory txMsg = Tx.create2TransferMessageOf(
                _tx,
                proof.states[i].nonce - 1,
                proof.pubkeysReceiver[i]
            );

            messages[i] = BLS.hashToPoint(domain, txMsg);
        }
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            signature,
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
