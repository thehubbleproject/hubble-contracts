// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";
import { Transition } from "../libs/Transition.sol";
import { Authenticity } from "../libs/Authenticity.sol";
import { BLS } from "../libs/BLS.sol";
import { Offchain } from "./Offchain.sol";

contract FrontendCreate2Transfer {
    using Tx for bytes;
    using Types for Types.UserState;

    function decode(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.Create2Transfer memory _tx)
    {
        return Offchain.decodeCreate2Transfer(encodedTx);
    }

    function encode(Offchain.Create2Transfer calldata _tx)
        external
        pure
        returns (bytes memory)
    {
        return Offchain.encodeCreate2Transfer(_tx);
    }

    function decodeWithPub(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.Create2TransferWithPub memory _tx)
    {
        return Offchain.decodeCreate2TransferWithPub(encodedTx);
    }

    function encodeWithPub(Offchain.Create2TransferWithPub calldata _tx)
        external
        pure
        returns (bytes memory)
    {
        return Offchain.encodeCreate2TransferWithPub(_tx);
    }

    function compress(bytes[] calldata encodedTxs)
        external
        pure
        returns (bytes memory)
    {
        Tx.Create2Transfer[] memory txTxs =
            new Tx.Create2Transfer[](encodedTxs.length);
        for (uint256 i = 0; i < txTxs.length; i++) {
            Offchain.Create2Transfer memory _tx =
                Offchain.decodeCreate2Transfer(encodedTxs[i]);
            txTxs[i] = Tx.Create2Transfer(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.toPubkeyID,
                _tx.amount,
                _tx.fee
            );
        }
        return Tx.serialize(txTxs);
    }

    function decompress(bytes calldata txs)
        external
        pure
        returns (Tx.Create2Transfer[] memory)
    {
        uint256 size = txs.create2TransferSize();
        Tx.Create2Transfer[] memory txTxs = new Tx.Create2Transfer[](size);
        for (uint256 i = 0; i < size; i++) {
            txTxs[i] = txs.create2TransferDecode(i);
        }
        return txTxs;
    }

    function signBytes(bytes calldata encodedTxWithPub)
        external
        pure
        returns (bytes memory)
    {
        Offchain.Create2TransferWithPub memory _tx =
            Offchain.decodeCreate2TransferWithPub(encodedTxWithPub);
        Tx.Create2Transfer memory txTx;
        txTx.fromIndex = _tx.fromIndex;
        txTx.amount = _tx.amount;
        txTx.fee = _tx.fee;
        return Tx.create2TransferMessageOf(txTx, _tx.nonce, _tx.toPubkey);
    }

    function validate(
        bytes calldata encodedTx,
        uint256[2] calldata signature,
        uint256[4] calldata pubkeySender,
        bytes32 pubkeyHashReceiver,
        bytes32 domain
    ) external view returns (bool) {
        Offchain.Create2Transfer memory _tx =
            Offchain.decodeCreate2Transfer(encodedTx);
        Tx.encodeDecimal(_tx.amount);
        Tx.encodeDecimal(_tx.fee);
        Tx.Create2Transfer memory txTx =
            Tx.Create2Transfer(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.toPubkeyID,
                _tx.amount,
                _tx.fee
            );
        bytes memory txMsg =
            Tx.create2TransferMessageOf(txTx, _tx.nonce, pubkeyHashReceiver);

        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifySingle(
            signature,
            pubkeySender,
            BLS.hashToPoint(domain, txMsg)
        );
        require(callSuccess, "Precompile call failed");
        require(checkSuccess, "Bad signature");
        // return something here otherwise the function doesn't raise error when revert. See #462
        return true;
    }

    function validateAndApply(
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
        Offchain.Create2Transfer memory _tx =
            Offchain.decodeCreate2Transfer(encodedTx);
        Types.UserState memory sender = Types.decodeState(senderEncoded);
        uint256 tokenID = sender.tokenID;
        (sender, result) = Transition.validateAndApplySender(
            tokenID,
            _tx.amount,
            _tx.fee,
            sender
        );
        if (result != Types.Result.Ok) return (sender.encode(), "", result);
        newReceiver = Transition.createState(
            _tx.toPubkeyID,
            tokenID,
            _tx.amount,
            0
        );

        return (sender.encode(), newReceiver, result);
    }

    function process(
        bytes32 stateRoot,
        bytes memory encodedTx,
        uint256 tokenID,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) public pure returns (bytes32 newRoot, Types.Result result) {
        Offchain.Create2Transfer memory offchainTx =
            Offchain.decodeCreate2Transfer(encodedTx);
        Tx.Create2Transfer memory _tx =
            Tx.Create2Transfer(
                offchainTx.fromIndex,
                offchainTx.toIndex,
                offchainTx.toPubkeyID,
                offchainTx.amount,
                offchainTx.fee
            );
        return
            Transition.processCreate2Transfer(
                stateRoot,
                _tx,
                tokenID,
                from,
                to
            );
    }

    function checkSignature(
        uint256[2] memory signature,
        Types.SignatureProofWithReceiver memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.Result) {
        Types.AuthCommon memory common =
            Types.AuthCommon({
                signature: signature,
                stateRoot: stateRoot,
                accountRoot: accountRoot,
                domain: domain,
                txs: txs
            });

        return Authenticity.verifyCreate2Transfer(common, proof);
    }
}
