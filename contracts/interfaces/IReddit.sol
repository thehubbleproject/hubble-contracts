pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";

interface IReddit {
    //
    // Transfer
    //

    function ApplyTransferTxSender(
        Types.AccountMerkleProof calldata _merkle_proof,
        Tx.Transfer calldata _tx
    ) external view returns (bytes memory, bytes32 newRoot);

    function ApplyTransferTxReceiver(
        Types.AccountMerkleProof calldata _merkle_proof,
        Tx.Transfer calldata _tx
    ) external view returns (bytes memory, bytes32 newRoot);

    function processTx(
        bytes32 _balanceRoot,
        Tx.Transfer calldata _tx,
        Types.AccountMerkleProof calldata fromAccountProof,
        Types.AccountMerkleProof calldata toAccountProof
    )
        external
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        );

    function processTransferCommit(
        bytes32 initialStateRoot,
        bytes calldata txs,
        Types.AccountMerkleProof[] calldata accountProofs,
        uint256 feeReceiver
    ) external view returns (bytes32, bool);
}
