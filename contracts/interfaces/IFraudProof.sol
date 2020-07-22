pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";

interface IFraudProof {
    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.Transaction calldata _tx,
        Types.PDAMerkleProof calldata _from_pda_proof,
        Types.AccountProofs calldata accountProofs
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

    function processBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        Types.Transaction[] calldata _txs,
        Types.BatchValidationProofs calldata batchProofs,
        bytes32 expectedTxRoot
    )
        external
        view
        returns (
            bytes32,
            bytes32,
            bool
        );

    function ApplyTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.Transaction calldata transaction
    ) external view returns (bytes memory, bytes32 newRoot);
}
