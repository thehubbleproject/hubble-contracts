// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Create2Transfer } from "../Create2Transfer.sol";
import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";
import { Transition } from "../libs/Transition.sol";

contract TestCreate2Transfer is Create2Transfer {
    function _checkSignature(
        uint256[2] memory signature,
        Types.SignatureProofWithReceiver memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public returns (uint256, Types.Result) {
        uint256 operationCost = gasleft();
        Types.AuthCommon memory common =
            Types.AuthCommon({
                signature: signature,
                stateRoot: stateRoot,
                accountRoot: accountRoot,
                domain: domain,
                txs: txs
            });
        Types.Result err = checkSignature(common, proof);
        return (operationCost - gasleft(), err);
    }

    function testProcessCreate2Transfer(
        bytes32 _balanceRoot,
        Tx.Create2Transfer memory _tx,
        uint256 tokenID,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) public pure returns (bytes32, Types.Result) {
        return
            Transition.processCreate2Transfer(
                _balanceRoot,
                _tx,
                tokenID,
                from,
                to
            );
    }

    function testProcessCreate2TransferCommit(
        bytes32 currentStateRoot,
        bytes32 postStateRoot,
        uint256 maxTxSize,
        uint256 feeReceiver,
        bytes memory txs,
        Types.StateMerkleProof[] memory proofs
    ) public returns (uint256 gasCost, Types.Result) {
        gasCost = gasleft();
        Types.Result result =
            processCreate2TransferCommit(
                currentStateRoot,
                postStateRoot,
                maxTxSize,
                feeReceiver,
                txs,
                proofs
            );
        return (gasCost - gasleft(), result);
    }
}
