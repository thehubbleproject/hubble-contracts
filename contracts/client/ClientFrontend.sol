pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";
import { Transition } from "../libs/Transition.sol";
import { Offchain } from "./Offchain.sol";

contract ClientFrontend {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.UserState;

    function decodeTransfer(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.Transfer memory _tx)
    {
        return Offchain.decodeTransfer(encodedTx);
    }

    function decodeMassMigration(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.MassMigration memory _tx)
    {
        return Offchain.decodeMassMigration(encodedTx);
    }

    function decodeCreate2Transfer(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.Create2Transfer memory _tx)
    {
        return Offchain.decodeCreate2Transfer(encodedTx);
    }

    function processTransferTx(
        bytes32 stateRoot,
        bytes memory txBytes,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    )
        public
        pure
        returns (
            bytes32 newRoot,
            bytes memory senderState,
            bytes memory receiverState,
            Types.Result result
        )
    {
        Offchain.Transfer memory _tx = Offchain.decodeTransfer(txBytes);
        uint256 tokenType = from.state.tokenType;
        (newRoot, senderState, result) = Transition.processSender(
            stateRoot,
            _tx.fromIndex,
            tokenType,
            _tx.amount,
            _tx.fee,
            from
        );
        if (result != Types.Result.Ok)
            return (newRoot, senderState, "", result);
        (newRoot, receiverState, result) = Transition.processReceiver(
            newRoot,
            _tx.toIndex,
            _tx.amount,
            tokenType,
            to
        );
        return (newRoot, senderState, receiverState, result);
    }

    function applyTransferTx(
        bytes memory txBytes,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    )
        public
        pure
        returns (bytes memory senderState, bytes memory receiverState)
    {
        Offchain.Transfer memory _tx = Offchain.decodeTransfer(txBytes);
        (senderState, ) = Transition.applySender(
            from,
            _tx.fromIndex,
            _tx.amount.add(_tx.fee)
        );
        (receiverState, ) = Transition.applyReceiver(
            to,
            _tx.toIndex,
            _tx.amount
        );
    }
}
