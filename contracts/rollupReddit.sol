pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {IReddit} from "./interfaces/IReddit.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Types} from "./libs/Types.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";

import {Tx} from "./libs/Tx.sol";
import {Transfer} from "./Transfer.sol";
import {Airdrop} from "./airdrop.sol";
import {BurnConsent} from "./BurnConsent.sol";
import {BurnExecution} from "./BurnExecution.sol";
import {CreateAccount} from "./CreateAccount.sol";

contract RollupReddit {
    Registry public nameRegistry;

    Airdrop public airdrop;
    Transfer public transfer;
    BurnConsent public burnConsent;
    CreateAccount public createAccount;
    BurnExecution public burnExecution;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        createAccount = CreateAccount(
            nameRegistry.getContractDetails(ParamManager.CREATE_ACCOUNT())
        );
        airdrop = Airdrop(
            nameRegistry.getContractDetails(ParamManager.AIRDROP())
        );
        transfer = Transfer(
            nameRegistry.getContractDetails(ParamManager.TRANSFER())
        );
        burnConsent = BurnConsent(
            nameRegistry.getContractDetails(ParamManager.BURN_CONSENT())
        );
        burnExecution = BurnExecution(
            nameRegistry.getContractDetails(ParamManager.BURN_EXECUTION())
        );
    }

    //
    // CreateAccount
    //

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        Types.CreateAccount memory transaction = RollupUtils
            .CreateAccountFromBytes(txBytes);
        return createAccount.ApplyCreateAccountTx(_merkle_proof, transaction);
    }

    function processCreateAccountTx(
        bytes32 stateRoot,
        Tx.CreateAccount memory _tx,
        Types.CreateAccountTransitionProof memory proof
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
        return createAccount.processTx(stateRoot, _tx, proof);
    }

    //
    // CreateAccount Fraud Checks
    //

    function create_shouldRollbackInvalidStateTransition(
        bytes32 stateRoot0,
        bytes32 stateRoot10,
        bytes memory txs,
        Types.CreateAccountTransitionProof[] memory proofs
    ) public view returns (bool) {
        (bytes32 stateRoot11, Types.ErrorCode err) = createAccount.processBatch(
            stateRoot0,
            txs,
            proofs
        );
        if (err != Types.ErrorCode.NoError) {
            return true;
        }
        if (stateRoot11 != stateRoot10) {
            return true;
        }
    }

    //
    // Airdrop
    //

    function ApplyAirdropTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        Types.DropTx memory transaction = RollupUtils.AirdropFromBytes(txBytes);
        return airdrop.ApplyAirdropTx(_merkle_proof, transaction);
    }

    function processAirdropTxReceiver(
        bytes32 stateRoot,
        uint256 tokenType,
        Tx.DropReceiver memory _tx,
        Types.AirdropTransitionReceiverProof memory proof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode
        )
    {
        return airdrop.processTxReceiver(stateRoot, tokenType, _tx, proof);
    }

    function processAirdropTxSenderPre(
        bytes32 stateRoot,
        Tx.DropSender memory _tx,
        Types.AirdropTransitionSenderProof memory proof
    ) public view returns (Types.ErrorCode) {
        return airdrop.processTxSenderPre(stateRoot, _tx, proof);
    }

    function processAirdropTxSenderPost(
        bytes32 stateRoot,
        uint256 amount,
        Tx.DropSender memory _tx,
        Types.AirdropTransitionSenderProof memory proof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode
        )
    {
        return airdrop.processTxSenderPost(stateRoot, amount, _tx, proof);
    }

    //
    // Airdrop Fraud
    //

    function airdrop_shouldRollbackInvalidSignature(
        uint256[2] calldata signature,
        Types.PubkeyAccountProof calldata proof,
        bytes calldata txs,
        bytes32 txCommit
    ) external view returns (bool) {
        uint256 senderAccountID = Tx.airdrop_senderAccountID(txs);
        return
            0 !=
            airdrop.signatureCheck(signature, proof, senderAccountID, txCommit);
    }

    function airdrop_shouldRollbackInvalidStateTransition(
        bytes32 stateRoot0,
        bytes32 stateRoot10,
        bytes memory txs,
        Types.AirdropTransitionSenderProof memory senderProof,
        Types.AirdropTransitionReceiverProof[] memory receiverProofs
    ) public view returns (bool) {
        (bytes32 stateRoot11, Types.ErrorCode err) = airdrop.processBatch(
            stateRoot0,
            txs,
            senderProof,
            receiverProofs
        );
        if (err != Types.ErrorCode.NoError) {
            return true;
        }
        if (stateRoot11 != stateRoot10) {
            return true;
        }
    }

    //
    // Transfer
    //

    function ApplyTransferTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        Types.Transaction memory transaction = RollupUtils.TxFromBytes(txBytes);
        return transfer.ApplyTx(_merkle_proof, transaction);
    }

    function processTransferTx(
        bytes32 stateRoot,
        Tx.Transfer memory _tx,
        Types.TransferTransitionProof memory proof
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
        return transfer.processTx(stateRoot, _tx, proof);
    }

    //
    // Transfer Fraud Checks
    //

    function transfer_shouldRollBackSignerAccountCheck(
        Types.SignerProof calldata proof,
        bytes32 state,
        bytes calldata signers,
        bytes calldata txs
    ) external view returns (bool) {
        return 0 != transfer.signerAccountCheck(proof, state, signers, txs);
    }

    function transfer_shouldRollbackInvalidSignature(
        uint256[2] calldata signature,
        Types.PubkeyAccountProofs calldata proof,
        bytes calldata txs,
        bytes calldata signers
    ) external view returns (bool) {
        return 0 != transfer.signatureCheck(signature, proof, txs, signers);
    }

    function transfer_shouldRollbackInvalidStateTransition(
        bytes32 stateRoot0,
        bytes32 stateRoot10,
        bytes memory txs,
        Types.TransferTransitionProof[] memory proofs
    ) public view returns (bool) {
        (bytes32 stateRoot11, Types.ErrorCode err) = transfer.processBatch(
            stateRoot0,
            txs,
            proofs
        );
        if (err != Types.ErrorCode.NoError) {
            return true;
        }
        if (stateRoot11 != stateRoot10) {
            return true;
        }
    }

    //
    // Burn Consent
    //

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.BurnConsent memory transaction = RollupUtils
            .BurnConsentTxFromBytes(txBytes);
        return burnConsent.ApplyBurnConsentTx(_merkle_proof, transaction);
    }

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.BurnConsentTransitionProof[] memory proofs
    ) public view returns (bytes32, Types.ErrorCode) {
        return burnConsent.processBatch(stateRoot, txs, proofs);
    }

    // Burn Consent Fraud Checks

    function burnConsent_shouldRollBackSignerAccountCheck(
        Types.SignerProof calldata proof,
        bytes32 state,
        bytes calldata signers,
        bytes calldata txs
    ) external view returns (bool) {
        return 0 != burnConsent.signerAccountCheck(proof, state, signers, txs);
    }

    function burnConsent_shouldRollbackInvalidSignature(
        uint256[2] calldata signature,
        Types.PubkeyAccountProofs calldata proof,
        bytes calldata txs,
        bytes calldata signers
    ) external view returns (bool) {
        return 0 != burnConsent.signatureCheck(signature, proof, txs, signers);
    }

    function burnConsent_shouldRollbackInvalidStateTransition(
        bytes32 stateRoot0,
        bytes32 stateRoot10,
        bytes memory txs,
        Types.BurnConsentTransitionProof[] memory proofs
    ) public view returns (bool) {
        (bytes32 stateRoot11, Types.ErrorCode err) = burnConsent.processBatch(
            stateRoot0,
            txs,
            proofs
        );
        if (err != Types.ErrorCode.NoError) {
            return true;
        }
        if (stateRoot11 != stateRoot10) {
            return true;
        }
    }

    //
    // Burn Execution
    //

    function ApplyBurnExecutionTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.BurnExecution memory transaction = RollupUtils
            .BurnExecutionFromBytes(txBytes);
        return burnExecution.ApplyBurnExecutionTx(_merkle_proof, transaction);
    }

    function processBurnExecutionTx(
        bytes32 stateRoot,
        uint256 stateID,
        Types.BurnExecutionProof memory proof
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
        return burnExecution.processTx(stateRoot, stateID, proof);
    }

    //
    // Burn Execution Fraud Checks
    //

    function burnExecution_shouldRollbackInvalidStateTransition(
        bytes32 stateRoot0,
        bytes32 stateRoot10,
        bytes memory txs,
        Types.BurnExecutionProof[] memory proofs
    ) public view returns (bool) {
        (bytes32 stateRoot11, Types.ErrorCode err) = burnExecution.processBatch(
            stateRoot0,
            txs,
            proofs
        );
        if (err != Types.ErrorCode.NoError) {
            return true;
        }
        if (stateRoot11 != stateRoot10) {
            return true;
        }
    }
}
