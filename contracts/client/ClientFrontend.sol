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

    function compressTransfer(Offchain.Transfer[] calldata txs)
        external
        pure
        returns (bytes memory)
    {
        Tx.Transfer[] memory txTxs = new Tx.Transfer[](txs.length);
        for (uint256 i = 0; i < txs.length; i++) {
            txTxs[i] = Tx.Transfer(
                txs[i].fromIndex,
                txs[i].toIndex,
                txs[i].amount,
                txs[i].fee
            );
        }
        return Tx.serialize(txTxs);
    }

    function compressMassMigration(Offchain.MassMigration[] calldata txs)
        external
        pure
        returns (bytes memory)
    {
        Tx.MassMigration[] memory txTxs = new Tx.MassMigration[](txs.length);
        for (uint256 i = 0; i < txs.length; i++) {
            txTxs[i] = Tx.MassMigration(
                txs[i].fromIndex,
                txs[i].amount,
                txs[i].fee
            );
        }
        return Tx.serialize(txTxs);
    }

    function compressCreate2Transfer(Offchain.Create2Transfer[] calldata txs)
        external
        pure
        returns (bytes memory)
    {
        Tx.Create2Transfer[] memory txTxs = new Tx.Create2Transfer[](
            txs.length
        );
        for (uint256 i = 0; i < txs.length; i++) {
            txTxs[i] = Tx.Create2Transfer(
                txs[i].fromIndex,
                txs[i].toIndex,
                txs[i].toAccID,
                txs[i].amount,
                txs[i].fee
            );
        }
        return Tx.serialize(txTxs);
    }

    function validateAndApplyTransfer(
        bytes calldata senderEncoded,
        bytes calldata receiverEncoded,
        Offchain.Transfer calldata _tx
    )
        external
        pure
        returns (
            bytes memory newSender,
            bytes memory newReceiver,
            Types.Result result
        )
    {
        Types.UserState memory sender = Types.decodeState(senderEncoded);
        Types.UserState memory receiver = Types.decodeState(receiverEncoded);
        uint256 tokenType = sender.tokenType;
        (sender, result) = Transition.validateAndApplySender(
            tokenType,
            _tx.amount,
            _tx.fee,
            sender
        );
        if (result != Types.Result.Ok) return (sender.encode(), "", result);
        (receiver, result) = Transition.validateAndApplyReceiver(
            tokenType,
            _tx.amount,
            receiver
        );
        return (sender.encode(), receiver.encode(), result);
    }

    function validateAndApplyMassMigration(
        bytes calldata senderEncoded,
        Offchain.MassMigration calldata _tx
    )
        external
        pure
        returns (
            bytes memory newSender,
            bytes memory withdrawState,
            Types.Result result
        )
    {
        Types.UserState memory sender = Types.decodeState(senderEncoded);
        (sender, result) = Transition.validateAndApplySender(
            sender.tokenType,
            _tx.amount,
            _tx.fee,
            sender
        );
        if (result != Types.Result.Ok) return (sender.encode(), "", result);
        withdrawState = Transition.createState(
            sender.pubkeyIndex,
            sender.tokenType,
            _tx.amount
        );
        return (sender.encode(), withdrawState, Types.Result.Ok);
    }

    function validateAndApplyCreate2Transfer(
        bytes calldata senderEncoded,
        Offchain.Create2Transfer calldata _tx
    )
        external
        pure
        returns (
            bytes memory newSender,
            bytes memory newReceiver,
            Types.Result result
        )
    {
        Types.UserState memory sender = Types.decodeState(senderEncoded);
        (sender, result) = Transition.validateAndApplySender(
            sender.tokenType,
            _tx.amount,
            _tx.fee,
            sender
        );
        if (result != Types.Result.Ok) return (sender.encode(), "", result);
        newReceiver = Transition.createState(
            _tx.toAccID,
            sender.tokenType,
            _tx.amount
        );
        return (sender.encode(), newReceiver, Types.Result.Ok);
    }
}
