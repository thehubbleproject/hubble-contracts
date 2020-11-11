pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";
import { Transition } from "../libs/Transition.sol";
import { Authenticity } from "../libs/Authenticity.sol";
import { BLS } from "../libs/BLS.sol";
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

    function encodeTransfer(Offchain.Transfer calldata _tx)
        external
        pure
        returns (bytes memory)
    {
        return Offchain.encodeTransfer(_tx);
    }

    function compressTransfer(bytes[] calldata encodedTxs)
        external
        pure
        returns (bytes memory)
    {
        Tx.Transfer[] memory txTxs = new Tx.Transfer[](encodedTxs.length);
        for (uint256 i = 0; i < txTxs.length; i++) {
            Offchain.Transfer memory _tx = Offchain.decodeTransfer(
                encodedTxs[i]
            );
            txTxs[i] = Tx.Transfer(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.amount,
                _tx.fee
            );
        }
        return Tx.serialize(txTxs);
    }

    function decompressTransfer(bytes calldata txs)
        external
        pure
        returns (Tx.Transfer[] memory txTxs)
    {
        uint256 size = txs.transferSize();
        Tx.Transfer[] memory txTxs = new Tx.Transfer[](size);
        for (uint256 i = 0; i < size; i++) {
            txTxs[i] = txs.transferDecode(i);
        }
        return txTxs;
    }

    function valiateTransfer(
        bytes calldata encodedTx,
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        bytes32 domain
    ) external view {
        Offchain.Transfer memory _tx = Offchain.decodeTransfer(encodedTx);
        Tx.encodeDecimal(_tx.amount);
        Tx.encodeDecimal(_tx.fee);
        Tx.Transfer memory txTx = Tx.Transfer(
            _tx.fromIndex,
            _tx.toIndex,
            _tx.amount,
            _tx.fee
        );
        bytes memory txMsg = Tx.transferMessageOf(txTx, _tx.nonce);

        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifySingle(
            signature,
            pubkey,
            BLS.hashToPoint(domain, txMsg)
        );
        require(callSuccess, "Precompile call failed");
        require(checkSuccess, "Bad signature");
    }

    function validateAndApplyTransfer(
        bytes calldata senderEncoded,
        bytes calldata receiverEncoded,
        bytes calldata encodedTx
    )
        external
        pure
        returns (
            bytes memory newSender,
            bytes memory newReceiver,
            Types.Result result
        )
    {
        Offchain.Transfer memory _tx = Offchain.decodeTransfer(encodedTx);
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

    function processTransfer(
        bytes32 stateRoot,
        bytes memory encodedTx,
        uint256 tokenType,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) public pure returns (bytes32 newRoot, Types.Result result) {
        Offchain.Transfer memory offchainTx = Offchain.decodeTransfer(
            encodedTx
        );
        Tx.Transfer memory _tx = Tx.Transfer(
            offchainTx.fromIndex,
            offchainTx.toIndex,
            offchainTx.amount,
            offchainTx.fee
        );
        return Transition.processTransfer(stateRoot, _tx, tokenType, from, to);
    }

    function checkSignatureTransfer(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.Result) {
        return
            Authenticity.verifyTransfer(
                signature,
                proof,
                stateRoot,
                accountRoot,
                domain,
                txs
            );
    }

    function encode(Types.UserState calldata state)
        external
        pure
        returns (bytes memory)
    {
        return Types.encode(state);
    }

    function decodeState(bytes calldata stateBytes)
        external
        pure
        returns (Types.UserState memory state)
    {
        return Types.decodeState(stateBytes);
    }
}
