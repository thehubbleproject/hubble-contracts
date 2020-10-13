pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "./Types.sol";
import { MerkleTreeUtilsLib } from "../MerkleTreeUtils.sol";

library Transition {
    using SafeMath for uint256;
    using Types for Types.UserState;

    function processReceiver(
        bytes32 stateRoot,
        uint256 receiverStateIndex,
        uint256 amount,
        uint256 tokenType,
        Types.StateMerkleProof memory proof
    ) public pure returns (bytes32 newRoot, bytes memory newToState, Types.Result) {
        Types.Result result = validateReceiver(
            stateRoot,
            receiverStateIndex,
            tokenType,
            proof
        );
        if (result != Types.Result.Ok) return (bytes32(0), "", result);
        (newToState, newRoot) = ApplyReceiver(
            proof,
            receiverStateIndex,
            amount
        );
        return (newRoot, newToState, Types.Result.Ok);
    }

    function validateSender(
        bytes32 stateRoot,
        uint256 senderIndex,
        uint256 tokenType,
        uint256 amount,
        uint256 fee,
        Types.StateMerkleProof memory sender
    ) internal pure returns (Types.Result) {
        require(
            MerkleTreeUtilsLib.verifyLeaf(
                stateRoot,
                keccak256(sender.state.encode()),
                senderIndex,
                sender.witness
            ),
            "Transfer: sender does not exist"
        );
        if (amount == 0) return Types.Result.InvalidTokenAmount;
        if (sender.state.balance < amount.add(fee))
            return Types.Result.NotEnoughTokenBalance;
        if (sender.state.tokenType != tokenType)
            return Types.Result.BadFromTokenType;
        return Types.Result.Ok;
    }

    function validateReceiver(
        bytes32 stateRoot,
        uint256 receiverIndex,
        uint256 tokenType,
        Types.StateMerkleProof memory receiver
    ) internal pure returns (Types.Result) {
        require(
            MerkleTreeUtilsLib.verifyLeaf(
                stateRoot,
                keccak256(receiver.state.encode()),
                receiverIndex,
                receiver.witness
            ),
            "Transfer: receiver does not exist"
        );
        if (receiver.state.tokenType != tokenType)
            return Types.Result.BadToTokenType;
        return Types.Result.Ok;
    }

    function ApplySender(
        Types.StateMerkleProof memory proof,
        uint256 senderStateIndex,
        uint256 decrement
    ) public pure returns (bytes memory newState, bytes32 stateRoot) {
        Types.UserState memory state = proof.state;
        state.balance = state.balance.sub(decrement);
        state.nonce++;
        newState = state.encode();
        stateRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(newState),
            senderStateIndex,
            proof.witness
        );
    }

    function ApplyReceiver(
        Types.StateMerkleProof memory proof,
        uint256 receiverStateIndex,
        uint256 increment
    ) public pure returns (bytes memory newState, bytes32 stateRoot) {
        Types.UserState memory state = proof.state;
        state.balance = state.balance.add(increment);
        newState = state.encode();
        stateRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(newState),
            receiverStateIndex,
            proof.witness
        );
    }
}
