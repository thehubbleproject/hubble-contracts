pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Create2Transfer } from "../Create2Transfer.sol";
import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";

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
        Types.Result err = checkSignature(
            signature,
            proof,
            stateRoot,
            accountRoot,
            domain,
            txs
        );
        return (operationCost - gasleft(), err);
    }

    function testProcessTx(
        bytes32 _balanceRoot,
        Tx.Create2Transfer memory _tx,
        uint256 tokenType,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
    ) public pure returns (bytes32, Types.Result) {
        return processTx(_balanceRoot, _tx, tokenType, from, to);
    }

    function testProcessCreate2TransferCommit(
        bytes32 stateRoot,
        bytes memory txs,
        Types.StateMerkleProof[] memory proofs,
        uint256 tokenType,
        uint256 feeReceiver
    ) public returns (bytes32, uint256) {
        bytes32 newRoot;
        uint256 operationCost = gasleft();
        (newRoot, ) = processCreate2TransferCommit(
            stateRoot,
            txs,
            proofs,
            tokenType,
            feeReceiver
        );
        return (newRoot, operationCost - gasleft());
    }
}
