// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";
import { Transition } from "../libs/Transition.sol";
import { Authenticity } from "../libs/Authenticity.sol";
import { BLS } from "../libs/BLS.sol";
import { Offchain } from "./Offchain.sol";

contract FrontendTransfer {
    using Tx for bytes;
    using Types for Types.UserState;

    function decode(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.Transfer memory _tx)
    {
        return Offchain.decodeTransfer(encodedTx);
    }

    function encode(Offchain.Transfer calldata _tx)
        external
        pure
        returns (bytes memory)
    {
        return Offchain.encodeTransfer(_tx);
    }

    function compress(bytes[] calldata encodedTxs)
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

    function decompress(bytes calldata txs)
        external
        pure
        returns (Tx.Transfer[] memory)
    {
        uint256 size = txs.transferSize();
        Tx.Transfer[] memory txTxs = new Tx.Transfer[](size);
        for (uint256 i = 0; i < size; i++) {
            txTxs[i] = txs.transferDecode(i);
        }
        return txTxs;
    }

    function signBytes(bytes calldata encodedTx)
        external
        pure
        returns (bytes memory)
    {
        Offchain.Transfer memory _tx = Offchain.decodeTransfer(encodedTx);
        Tx.Transfer memory txTx = Tx.Transfer(
            _tx.fromIndex,
            _tx.toIndex,
            _tx.amount,
            _tx.fee
        );
        return Tx.transferMessageOf(txTx, _tx.nonce);
    }

    function validate(
        bytes calldata encodedTx,
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        bytes32 domain
    ) external view returns (bool) {
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
        // return something here otherwise the function doesn't raise error when revert. See #462
        return true;
    }

    function validateAndApply(
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
        uint256 tokenID = sender.tokenID;
        (sender, result) = Transition.validateAndApplySender(
            tokenID,
            _tx.amount,
            _tx.fee,
            sender
        );
        if (result != Types.Result.Ok) return (sender.encode(), "", result);
        (receiver, result) = Transition.validateAndApplyReceiver(
            tokenID,
            _tx.amount,
            receiver
        );
        return (sender.encode(), receiver.encode(), result);
    }

    function process(
        bytes32 stateRoot,
        bytes memory encodedTx,
        uint256 tokenID,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) public pure returns (bytes32 newRoot, Types.Result result) {
        Offchain.Transfer memory offchainTx = Offchain.decodeTransfer(
            encodedTx
        );
        if (from.state.nonce+1 != offchainTx.nonce) {
            return (newRoot, Types.Result.BadNonce); 
        }
        Tx.Transfer memory _tx = Tx.Transfer(
            offchainTx.fromIndex,
            offchainTx.toIndex,
            offchainTx.amount,
            offchainTx.fee
        );
        return Transition.processTransfer(stateRoot, _tx, tokenID, from, to);
    }

    function checkSignature(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.Result) {
        Types.AuthCommon memory common = Types.AuthCommon({
            signature: signature,
            stateRoot: stateRoot,
            accountRoot: accountRoot,
            domain: domain,
            txs: txs
        });
        return Authenticity.verifyTransfer(common, proof);
    }
}
