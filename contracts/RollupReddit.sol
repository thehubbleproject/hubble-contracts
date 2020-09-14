pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { IReddit } from "./interfaces/IReddit.sol";
import { Transfer } from "./Transfer.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Types } from "./libs/Types.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { Tx } from "./libs/Tx.sol";
import { MassMigration } from "./MassMigrations.sol";

contract RollupReddit {
    using Tx for bytes;
    Transfer public transfer;

    function checkTransferSignature(
        bytes32 appID,
        uint256[2] memory signature,
        bytes32 stateRoot,
        bytes32 accountRoot,
        Types.SignatureProof memory proof,
        bytes memory txs
    ) public view returns (Types.ErrorCode) {
        transfer.checkSignature(
            signature,
            proof,
            stateRoot,
            accountRoot,
            appID,
            txs
        );
    }

    Registry public nameRegistry;
    IReddit public createAccount;
    IReddit public airdrop;
    IReddit public burnConsent;
    IReddit public burnExecution;
    MassMigration public massMigs;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        createAccount = IReddit(
            nameRegistry.getContractDetails(ParamManager.CREATE_ACCOUNT())
        );
        airdrop = IReddit(
            nameRegistry.getContractDetails(ParamManager.AIRDROP())
        );
        transfer = Transfer(
            nameRegistry.getContractDetails(ParamManager.TRANSFER())
        );
        burnConsent = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_CONSENT())
        );
        burnExecution = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_EXECUTION())
        );
        massMigs = MassMigration(
            nameRegistry.getContractDetails(ParamManager.MASS_MIGS())
        );
    }

    //
    // CreateAccount
    //

    function createPublickeys(bytes[] memory publicKeys)
        public
        returns (uint256[] memory)
    {
        return createAccount.createPublickeys(publicKeys);
    }

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        bytes memory txs = RollupUtils.CompressCreateAccountFromEncoded(
            txBytes
        );
        return createAccount.ApplyCreateAccountTx(_merkle_proof, txs, 0);
    }

    function processCreateAccountTx(
        bytes32 _balanceRoot,
        bytes memory txBytes,
        Types.AccountMerkleProof memory to_account_proof
    )
        public
        view
        returns (
            bytes32 newRoot,
            bytes memory createdAccountBytes,
            Types.ErrorCode,
            bool
        )
    {
        bytes memory txs = RollupUtils.CompressCreateAccountFromEncoded(
            txBytes
        );
        return
            createAccount.processCreateAccountTx(
                _balanceRoot,
                txs,
                0,
                to_account_proof
            );
    }

    //
    // Airdrop
    //

    function ApplyAirdropTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        bytes memory emptySig = new bytes(65);
        bytes memory txs = RollupUtils.CompressAirdropFromEncoded(
            txBytes,
            emptySig
        );
        return airdrop.ApplyAirdropTx(_merkle_proof, txs, 0);
    }

    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes memory sig,
        bytes memory txBytes,
        Types.AccountMerkleProof memory fromAccountProof,
        Types.AccountMerkleProof memory toAccountProof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        bytes memory txs = RollupUtils.CompressAirdropFromEncoded(txBytes, sig);
        // Validate ECDSA sig
        return
            airdrop.processAirdropTx(
                _balanceRoot,
                txs,
                0,
                fromAccountProof,
                toAccountProof
            );
    }

    //
    // Transfer
    //

    function ApplyTransferTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes,
        bool isSender
    ) public view returns (bytes memory, bytes32 newRoot) {
        (Tx.Transfer memory _tx, ) = txBytes.transfer_fromEncoded();
        if (isSender) {
            return transfer.ApplyTransferTxSender(_merkle_proof, _tx);
        } else {
            return transfer.ApplyTransferTxReceiver(_merkle_proof, _tx);
        }
    }

    function processTransferTx(
        bytes32 _balanceRoot,
        bytes memory sig,
        bytes memory txBytes,
        Types.AccountMerkleProof memory fromAccountProof,
        Types.AccountMerkleProof memory toAccountProof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        (Tx.Transfer memory _tx, uint256 tokenType) = txBytes
            .transfer_fromEncoded();
        // Validate BLS sig
        return
            transfer.processTx(
                _balanceRoot,
                _tx,
                tokenType,
                fromAccountProof,
                toAccountProof
            );
    }

    //
    // Burn Consent
    //

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        bytes memory txs = RollupUtils.CompressBurnConsentFromEncoded(txBytes);
        return burnConsent.ApplyBurnConsentTx(_merkle_proof, txs, 0);
    }

    function processBurnConsentTx(
        bytes32 _balanceRoot,
        bytes memory txBytes,
        Types.AccountMerkleProof memory _fromAccountProof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        bytes memory txs = RollupUtils.CompressBurnConsentFromEncoded(txBytes);
        return
            burnConsent.processBurnConsentTx(
                _balanceRoot,
                txs,
                0,
                _fromAccountProof
            );
    }

    //
    // Burn Execution
    //

    function ApplyBurnExecutionTx(Types.AccountMerkleProof memory _merkle_proof)
        public
        view
        returns (bytes memory updatedAccount, bytes32 newRoot)
    {
        return burnExecution.ApplyBurnExecutionTx(_merkle_proof);
    }

    function processBurnExecutionTx(
        bytes32 _balanceRoot,
        bytes memory txBytes,
        Types.AccountMerkleProof memory _fromAccountProof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        bytes memory txs = RollupUtils.CompressBurnExecutionFromEncoded(
            txBytes
        );
        return
            burnExecution.processBurnExecutionTx(
                _balanceRoot,
                txs,
                0,
                _fromAccountProof
            );
    }

    function processCommit(
        bytes32 initialStateRoot,
        bytes memory txs,
        Types.AccountMerkleProof[] memory accountProofs,
        uint256 tokenType,
        uint256 feeReceiver,
        Types.Usage batchType
    ) public view returns (bytes32, bool) {
        if (batchType == Types.Usage.CreateAccount) {
            return
                createAccount.processCreateAccountBatch(
                    initialStateRoot,
                    txs,
                    accountProofs
                );
        } else if (batchType == Types.Usage.Airdrop) {
            return
                airdrop.processAirdropBatch(
                    initialStateRoot,
                    txs,
                    accountProofs
                );
        } else if (batchType == Types.Usage.Transfer) {
            return
                transfer.processTransferCommit(
                    initialStateRoot,
                    txs,
                    accountProofs,
                    tokenType,
                    feeReceiver
                );
        } else if (batchType == Types.Usage.BurnConsent) {
            return
                burnConsent.processBurnConsentBatch(
                    initialStateRoot,
                    txs,
                    accountProofs
                );
        } else if (batchType == Types.Usage.BurnExecution) {
            return
                burnExecution.processBurnExecutionBatch(
                    initialStateRoot,
                    txs,
                    accountProofs
                );
        } else {
            revert("Invalid BatchType to dispute");
        }
    }

    function processMassMigrationCommit(
        Types.MMCommitment memory commitment,
        Types.AccountMerkleProof[] memory accountProofs
    ) public view returns (bytes32, bool) {
        // call mass mig contract
        return massMigs.processMassMigrationCommit(commitment, accountProofs);
    }
}
