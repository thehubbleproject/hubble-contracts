// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "./Types.sol";
import { MerkleTree } from "../libs/MerkleTree.sol";
import { Tx } from "./Tx.sol";

/**
    @notice Perform state transitions for transactions. This library does not verify the signature of the message.
 */
library Transition {
    using SafeMath for uint256;
    using Types for Types.UserState;

    function processTransfer(
        bytes32 stateRoot,
        Tx.Transfer memory _tx,
        uint256 tokenID,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) internal pure returns (bytes32 newRoot, Types.Result result) {
        (newRoot, result) = processSender(
            stateRoot,
            _tx.fromIndex,
            tokenID,
            _tx.amount,
            _tx.fee,
            from
        );
        if (result != Types.Result.Ok) return (newRoot, result);
        (newRoot, result) = processReceiver(
            newRoot,
            _tx.toIndex,
            tokenID,
            _tx.amount,
            to
        );
        return (newRoot, result);
    }

    function processMassMigration(
        bytes32 stateRoot,
        Tx.MassMigration memory _tx,
        uint256 tokenID,
        Types.StateMerkleProof memory from
    )
        internal
        pure
        returns (
            bytes32 newRoot,
            bytes memory freshState,
            Types.Result result
        )
    {
        (newRoot, result) = processSender(
            stateRoot,
            _tx.fromIndex,
            tokenID,
            _tx.amount,
            _tx.fee,
            from
        );
        if (result != Types.Result.Ok) return (newRoot, "", result);
        freshState = createState(
            from.state.pubkeyID,
            tokenID,
            _tx.amount,
            from.state.nonce
        );

        return (newRoot, freshState, Types.Result.Ok);
    }

    function processCreate2Transfer(
        bytes32 stateRoot,
        Tx.Create2Transfer memory _tx,
        uint256 tokenID,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) internal pure returns (bytes32 newRoot, Types.Result result) {
        (newRoot, result) = processSender(
            stateRoot,
            _tx.fromIndex,
            tokenID,
            _tx.amount,
            _tx.fee,
            from
        );
        if (result != Types.Result.Ok) return (newRoot, result);
        newRoot = processCreate2TransferReceiver(newRoot, _tx, tokenID, to);

        return (newRoot, Types.Result.Ok);
    }

    function processCreate2TransferReceiver(
        bytes32 stateRoot,
        Tx.Create2Transfer memory _tx,
        uint256 tokenID,
        Types.StateMerkleProof memory proof
    ) internal pure returns (bytes32 newRoot) {
        // Validate we are creating on a empty state
        require(
            MerkleTree.verify(
                stateRoot,
                keccak256(abi.encode(0)),
                _tx.toIndex,
                proof.witness
            ),
            "Create2Transfer: receiver proof invalid"
        );
        bytes memory encodedState =
            createState(_tx.toPubkeyID, tokenID, _tx.amount, 0);

        newRoot = MerkleTree.computeRoot(
            keccak256(encodedState),
            _tx.toIndex,
            proof.witness
        );
        return newRoot;
    }

    function processSender(
        bytes32 stateRoot,
        uint256 senderStateIndex,
        uint256 tokenID,
        uint256 amount,
        uint256 fee,
        Types.StateMerkleProof memory proof
    ) internal pure returns (bytes32 newRoot, Types.Result) {
        require(
            MerkleTree.verify(
                stateRoot,
                keccak256(proof.state.encode()),
                senderStateIndex,
                proof.witness
            ),
            "Transition: Sender does not exist"
        );
        (Types.UserState memory newSender, Types.Result result) =
            validateAndApplySender(tokenID, amount, fee, proof.state);
        if (result != Types.Result.Ok) return (bytes32(0), result);
        newRoot = MerkleTree.computeRoot(
            keccak256(newSender.encode()),
            senderStateIndex,
            proof.witness
        );
        return (newRoot, Types.Result.Ok);
    }

    function processReceiver(
        bytes32 stateRoot,
        uint256 receiverStateIndex,
        uint256 tokenID,
        uint256 amount,
        Types.StateMerkleProof memory proof
    ) internal pure returns (bytes32 newRoot, Types.Result) {
        require(
            MerkleTree.verify(
                stateRoot,
                keccak256(proof.state.encode()),
                receiverStateIndex,
                proof.witness
            ),
            "Transition: receiver does not exist"
        );
        (Types.UserState memory newReceiver, Types.Result result) =
            validateAndApplyReceiver(tokenID, amount, proof.state);
        if (result != Types.Result.Ok) return (bytes32(0), result);
        newRoot = MerkleTree.computeRoot(
            keccak256(newReceiver.encode()),
            receiverStateIndex,
            proof.witness
        );
        return (newRoot, Types.Result.Ok);
    }

    function validateAndApplySender(
        uint256 tokenID,
        uint256 amount,
        uint256 fee,
        Types.UserState memory sender
    ) internal pure returns (Types.UserState memory, Types.Result) {
        if (amount == 0) return (sender, Types.Result.InvalidTokenAmount);
        uint256 decrement = amount.add(fee);
        if (sender.balance < decrement)
            return (sender, Types.Result.NotEnoughTokenBalance);
        if (sender.tokenID != tokenID)
            return (sender, Types.Result.BadFromTokenID);
        Types.UserState memory newSender =
            Types.UserState({
                pubkeyID: sender.pubkeyID,
                tokenID: sender.tokenID,
                balance: sender.balance.sub(decrement),
                nonce: sender.nonce.add(1)
            });
        return (newSender, Types.Result.Ok);
    }

    function validateAndApplyReceiver(
        uint256 tokenID,
        uint256 amount,
        Types.UserState memory receiver
    ) internal pure returns (Types.UserState memory newReceiver, Types.Result) {
        if (receiver.tokenID != tokenID)
            return (receiver, Types.Result.BadToTokenID);
        newReceiver = Types.UserState({
            pubkeyID: receiver.pubkeyID,
            tokenID: receiver.tokenID,
            balance: receiver.balance.add(amount),
            nonce: receiver.nonce
        });
        return (newReceiver, Types.Result.Ok);
    }

    function createState(
        uint256 pubkeyID,
        uint256 tokenID,
        uint256 amount,
        uint256 nonce
    ) internal pure returns (bytes memory stateEncoded) {
        Types.UserState memory state =
            Types.UserState({
                pubkeyID: pubkeyID,
                tokenID: tokenID,
                balance: amount,
                nonce: nonce
            });
        return state.encode();
    }
}
