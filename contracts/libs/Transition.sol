pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "./Types.sol";
import { MerkleTree } from "../libs/MerkleTree.sol";

library Transition {
    using SafeMath for uint256;
    using Types for Types.UserState;

    function processSender(
        bytes32 stateRoot,
        uint256 senderStateIndex,
        uint256 tokenType,
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
        (
            Types.UserState memory newSender,
            Types.Result result
        ) = validateAndApplySender(tokenType, amount, fee, proof.state);
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
        uint256 tokenType,
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
        (
            Types.UserState memory newReceiver,
            Types.Result result
        ) = validateAndApplyReceiver(tokenType, amount, proof.state);
        if (result != Types.Result.Ok) return (bytes32(0), result);
        newRoot = MerkleTree.computeRoot(
            keccak256(newReceiver.encode()),
            receiverStateIndex,
            proof.witness
        );
        return (newRoot, Types.Result.Ok);
    }

    function validateAndApplySender(
        uint256 tokenType,
        uint256 amount,
        uint256 fee,
        Types.UserState memory sender
    ) internal pure returns (Types.UserState memory, Types.Result) {
        if (amount == 0) return (sender, Types.Result.InvalidTokenAmount);
        uint256 decrement = amount.add(fee);
        if (sender.balance < decrement)
            return (sender, Types.Result.NotEnoughTokenBalance);
        if (sender.tokenType != tokenType)
            return (sender, Types.Result.BadFromTokenType);
        Types.UserState memory newSender = Types.UserState({
            pubkeyIndex: sender.pubkeyIndex,
            tokenType: sender.tokenType,
            balance: sender.balance.sub(decrement),
            nonce: sender.nonce.add(1)
        });
        return (newSender, Types.Result.Ok);
    }

    function validateAndApplyReceiver(
        uint256 tokenType,
        uint256 amount,
        Types.UserState memory receiver
    ) internal pure returns (Types.UserState memory newReceiver, Types.Result) {
        if (receiver.tokenType != tokenType)
            return (receiver, Types.Result.BadToTokenType);
        newReceiver = Types.UserState({
            pubkeyIndex: receiver.pubkeyIndex,
            tokenType: receiver.tokenType,
            balance: receiver.balance.add(amount),
            nonce: receiver.nonce
        });
        return (newReceiver, Types.Result.Ok);
    }

    function createState(
        uint256 pubkeyIndex,
        uint256 tokenType,
        uint256 amount
    ) internal pure returns (bytes memory stateEncoded) {
        Types.UserState memory state = Types.UserState({
            pubkeyIndex: pubkeyIndex,
            tokenType: tokenType,
            balance: amount,
            nonce: 0
        });
        return state.encode();
    }
}
