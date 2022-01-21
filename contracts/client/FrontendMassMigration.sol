// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";
import { Transition } from "../libs/Transition.sol";
import { Authenticity } from "../libs/Authenticity.sol";
import { BLS } from "../libs/BLS.sol";
import { Offchain } from "./Offchain.sol";

contract FrontendMassMigration {
    using Tx for bytes;
    using Types for Types.UserState;

    function decode(bytes calldata encodedTx)
        external
        pure
        returns (Offchain.MassMigration memory _tx)
    {
        return Offchain.decodeMassMigration(encodedTx);
    }

    function encode(Offchain.MassMigration calldata _tx)
        external
        pure
        returns (bytes memory)
    {
        return Offchain.encodeMassMigration(_tx);
    }

    function compress(bytes[] calldata encodedTxs)
        external
        pure
        returns (bytes memory)
    {
        Tx.MassMigration[] memory txTxs =
            new Tx.MassMigration[](encodedTxs.length);
        for (uint256 i = 0; i < txTxs.length; i++) {
            Offchain.MassMigration memory _tx =
                Offchain.decodeMassMigration(encodedTxs[i]);
            txTxs[i] = Tx.MassMigration(_tx.fromIndex, _tx.amount, _tx.fee);
        }
        return Tx.serialize(txTxs);
    }

    function decompress(bytes calldata txs)
        external
        pure
        returns (Tx.MassMigration[] memory)
    {
        uint256 size = txs.massMigrationSize();
        Tx.MassMigration[] memory txTxs = new Tx.MassMigration[](size);
        for (uint256 i = 0; i < size; i++) {
            txTxs[i] = txs.massMigrationDecode(i);
        }
        return txTxs;
    }

    function signBytes(bytes calldata encodedTx)
        external
        pure
        returns (bytes memory)
    {
        Offchain.MassMigration memory _tx =
            Offchain.decodeMassMigration(encodedTx);
        Tx.MassMigration memory txTx =
            Tx.MassMigration(_tx.fromIndex, _tx.amount, _tx.fee);
        return Tx.massMigrationMessageOf(txTx, _tx.nonce, _tx.spokeID);
    }

    function validate(
        bytes calldata encodedTx,
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        bytes32 domain
    ) external view returns (bool) {
        Offchain.MassMigration memory _tx =
            Offchain.decodeMassMigration(encodedTx);
        Tx.encodeDecimal(_tx.amount);
        Tx.encodeDecimal(_tx.fee);
        Tx.MassMigration memory txTx =
            Tx.MassMigration(_tx.fromIndex, _tx.amount, _tx.fee);
        bytes memory txMsg =
            Tx.massMigrationMessageOf(txTx, _tx.nonce, _tx.spokeID);

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
        Offchain.MassMigration memory _tx =
            Offchain.decodeMassMigration(encodedTx);
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
            sender.pubkeyID,
            tokenID,
            _tx.amount,
            sender.nonce
        );
        return (sender.encode(), newReceiver, result);
    }

    function process(
        bytes32 stateRoot,
        bytes memory encodedTx,
        uint256 tokenID,
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
        Offchain.MassMigration memory offchainTx =
            Offchain.decodeMassMigration(encodedTx);
        Tx.MassMigration memory _tx =
            Tx.MassMigration(
                offchainTx.fromIndex,
                offchainTx.amount,
                offchainTx.fee
            );
        return Transition.processMassMigration(stateRoot, _tx, tokenID, from);
    }

    function checkSignature(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        uint256 spokeID,
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
        return Authenticity.verifyMassMigration(common, proof, spokeID);
    }
}
