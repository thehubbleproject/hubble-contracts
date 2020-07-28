pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";

interface IReddit {
    //
    // CreateAccount
    //
    function createPublickeys(bytes[] calldata publicKeys)
        external
        returns (uint256[] memory);

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        bytes calldata txs,
        uint256 i
    ) external view returns (bytes memory, bytes32 newRoot);

    function processCreateAccountTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes calldata txs,
        uint256 i,
        Types.PDAMerkleProof calldata _to_pda_proof,
        Types.AccountMerkleProof calldata to_account_proof
    )
        external
        view
        returns (
            bytes32 newRoot,
            bytes memory createdAccountBytes,
            Types.ErrorCode,
            bool
        );

    //
    // Airdrop
    //

    function ApplyAirdropTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        bytes calldata txs,
        uint256 i
    ) external view returns (bytes memory, bytes32);

    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes calldata txs,
        uint256 i,
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

    //
    // Transfer
    //

    function ApplyTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        bytes calldata txs,
        uint256 i
    ) external view returns (bytes memory, bytes32 newRoot);

    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes calldata txs,
        uint256 i,
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

    //
    // Burn Consent
    //

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.BurnConsent calldata _tx
    ) external view returns (bytes memory updatedAccount, bytes32 newRoot);

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

    //
    // Burn Execution
    //

    function ApplyBurnExecutionTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        Types.BurnExecution calldata _tx
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

    function processCreateAccountBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes calldata txs,
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

    function processAirdropBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes calldata txs,
        bytes[] calldata signatures,
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

    function processTransferBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes calldata txs,
        bytes[] calldata signatures,
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

    function processBurnConsentBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes calldata txs,
        bytes[] calldata signatures,
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

    function processBurnExecutionBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes calldata txs,
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
