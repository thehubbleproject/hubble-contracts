pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";

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
        bytes calldata txs,
        uint256 i,
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
        bytes calldata txs,
        uint256 i,
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

    //
    // Burn Consent
    //

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof calldata _merkle_proof,
        bytes calldata txs,
        uint256 i
    ) external view returns (bytes memory updatedAccount, bytes32 newRoot);

    function processBurnConsentTx(
        bytes32 _balanceRoot,
        bytes calldata txs,
        uint256 i,
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
        Types.AccountMerkleProof calldata _merkle_proof
    ) external view returns (bytes memory updatedAccount, bytes32 newRoot);

    function processBurnExecutionTx(
        bytes32 _balanceRoot,
        bytes calldata txs,
        uint256 i,
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

    function processCreateAccountCommit(
        bytes32 initialStateRoot,
        bytes calldata txs,
        Types.AccountMerkleProof[] calldata accountProofs
    ) external view returns (bytes32, bool);

    function processAirdropCommit(
        bytes32 initialStateRoot,
        bytes calldata txs,
        Types.AccountMerkleProof[] calldata accountProofs
    ) external view returns (bytes32, bool);

    function processTransferCommit(
        bytes32 initialStateRoot,
        bytes calldata txs,
        Types.AccountMerkleProof[] calldata accountProofs,
        uint256 feeReceiver
    ) external view returns (bytes32, bool);

    function processBurnConsentCommit(
        bytes32 initialStateRoot,
        bytes calldata txs,
        Types.AccountMerkleProof[] calldata accountProofs
    ) external view returns (bytes32, bool);

    function processBurnExecutionCommit(
        bytes32 initialStateRoot,
        bytes calldata txs,
        Types.AccountMerkleProof[] calldata accountProofs
    ) external view returns (bytes32, bool);
}
