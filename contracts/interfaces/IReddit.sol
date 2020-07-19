pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Types} from "../libs/Types.sol";

interface IReddit {
    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.DropTx calldata _tx,
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

    function ApplyAirdropTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.DropTx calldata _transaction
    ) external view returns (bytes memory, bytes32);

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

    function ApplyTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.Transaction calldata transaction
    ) external view returns (bytes memory, bytes32 newRoot);

    function processBurnConsentTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnConsent calldata _tx,
        Types.PDAMerkleProof calldata _from_pda_proof,
        Types.AccountMerkleProof calldata _fromAccountProof
    )
        external
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        );

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.BurnConsent calldata _tx
    ) external view returns (bytes memory updatedAccount, bytes32 newRoot);

    function processBurnExecutionTx(
        bytes32 _balanceRoot,
        Types.BurnExecution calldata _tx,
        Types.AccountMerkleProof calldata _fromAccountProof
    )
        external
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        );

    function ApplyBurnExecutionTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.BurnExecution calldata _tx
    ) external view returns (bytes memory updatedAccount, bytes32 newRoot);

    function processBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes[] calldata _txs,
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
}
