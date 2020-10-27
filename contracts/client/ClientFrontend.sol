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
        uint256[2] memory message = BLS.hashToPoint(domain, txMsg);
        require(BLS.verifySingle(signature, pubkey, message), "Bad Signature");
    }

    function valiateMassMigration(
        bytes calldata encodedTx,
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        bytes32 domain
    ) external view {
        Offchain.MassMigration memory _tx = Offchain.decodeMassMigration(
            encodedTx
        );
        Tx.encodeDecimal(_tx.amount);
        Tx.encodeDecimal(_tx.fee);
        Tx.MassMigration memory txTx = Tx.MassMigration(
            _tx.fromIndex,
            _tx.amount,
            _tx.fee
        );
        bytes memory txMsg = Tx.massMigrationMessageOf(
            txTx,
            _tx.nonce,
            _tx.spokeID
        );
        uint256[2] memory message = BLS.hashToPoint(domain, txMsg);
        require(BLS.verifySingle(signature, pubkey, message), "Bad Signature");
    }

    function valiateCreate2Transfer(
        bytes calldata encodedTx,
        uint256[2] calldata signature,
        uint256[4] calldata fromPubkey,
        uint256[4] calldata toPubkey,
        bytes32 domain
    ) external view {
        Offchain.Create2Transfer memory _tx = Offchain.decodeCreate2Transfer(
            encodedTx
        );
        Tx.encodeDecimal(_tx.amount);
        Tx.encodeDecimal(_tx.fee);
        Tx.Create2Transfer memory txTx = Tx.Create2Transfer(
            _tx.fromIndex,
            _tx.toIndex,
            _tx.toAccID,
            _tx.amount,
            _tx.fee
        );
        bytes memory txMsg = Tx.create2TransferMessageOf(
            txTx,
            _tx.nonce,
            fromPubkey,
            toPubkey
        );
        uint256[2] memory message = BLS.hashToPoint(domain, txMsg);
        require(
            BLS.verifySingle(signature, fromPubkey, message),
            "Bad Signature"
        );
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

    function validateAndApplyMassMigration(
        bytes calldata senderEncoded,
        bytes calldata encodedTx
    )
        external
        pure
        returns (
            bytes memory newSender,
            bytes memory withdrawState,
            Types.Result result
        )
    {
        Offchain.MassMigration memory _tx = Offchain.decodeMassMigration(
            encodedTx
        );
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
        Offchain.Create2Transfer memory _tx = Offchain.decodeCreate2Transfer(
            encodedTx
        );

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

    function processMassMigration(
        bytes32 stateRoot,
        bytes memory encodedTx,
        uint256 tokenType,
        Types.StateMerkleProof memory from
    )
        public
        pure
        returns (
            bytes32 newRoot,
            bytes memory freshState,
            Types.Result result
        )
    {
        Offchain.MassMigration memory offchainTx = Offchain.decodeMassMigration(
            encodedTx
        );
        Tx.MassMigration memory _tx = Tx.MassMigration(
            offchainTx.fromIndex,
            offchainTx.amount,
            offchainTx.fee
        );
        return Transition.processMassMigration(stateRoot, _tx, tokenType, from);
    }

    function processCreate2Transfer(
        bytes32 stateRoot,
        bytes memory encodedTx,
        uint256 tokenType,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) public pure returns (bytes32 newRoot, Types.Result result) {
        Offchain.Create2Transfer memory offchainTx = Offchain
            .decodeCreate2Transfer(encodedTx);
        Tx.Create2Transfer memory _tx = Tx.Create2Transfer(
            offchainTx.fromIndex,
            offchainTx.toIndex,
            offchainTx.toAccID,
            offchainTx.amount,
            offchainTx.fee
        );

        return
            Transition.processCreate2Transfer(
                stateRoot,
                _tx,
                tokenType,
                from,
                to
            );
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

    function checkSignatureMassMigration(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        uint256 spokeID,
        bytes memory txs
    ) public view returns (Types.Result) {
        return
            Authenticity.verifyMassMigration(
                signature,
                proof,
                stateRoot,
                accountRoot,
                domain,
                spokeID,
                txs
            );
    }

    function checkSignatureCreate2Transfer(
        uint256[2] memory signature,
        Types.SignatureProofWithReceiver memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.Result) {
        return
            Authenticity.verifyCreate2Transfer(
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
