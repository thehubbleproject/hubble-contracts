pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { IReddit } from "./interfaces/IReddit.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Types } from "./libs/Types.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract RollupReddit {
    Registry public nameRegistry;
    IReddit public createAccount;
    IReddit public airdrop;
    IReddit public transfer;
    IReddit public burnConsent;
    IReddit public burnExecution;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        createAccount = IReddit(
            nameRegistry.getContractDetails(ParamManager.CREATE_ACCOUNT())
        );

        airdrop = IReddit(
            nameRegistry.getContractDetails(ParamManager.AIRDROP())
        );
        transfer = IReddit(
            nameRegistry.getContractDetails(ParamManager.TRANSFER())
        );
        burnConsent = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_CONSENT())
        );
        burnExecution = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_EXECUTION())
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
        Types.CreateAccount memory transaction = RollupUtils
            .CreateAccountFromBytes(txBytes);
        return createAccount.ApplyCreateAccountTx(_merkle_proof, transaction);
    }

    function processCreateAccountTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes memory txBytes,
        Types.PDAMerkleProof memory _to_pda_proof,
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
        Types.CreateAccount memory _tx = RollupUtils.CreateAccountFromBytes(
            txBytes
        );
        return
            createAccount.processCreateAccountTx(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _to_pda_proof,
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
        Types.DropTx memory transaction = RollupUtils.AirdropFromBytes(txBytes);
        return airdrop.ApplyAirdropTx(_merkle_proof, transaction);
    }

    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes memory sig,
        bytes memory txBytes,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
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
        Types.DropTx memory _tx = RollupUtils.AirdropFromBytes(txBytes);
        _tx.signature = sig;
        return
            airdrop.processAirdropTx(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
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
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes memory sig,
        bytes memory txBytes,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
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
        Types.Transaction memory _tx = RollupUtils.TxFromBytes(txBytes);
        _tx.signature = sig;
        return
            transfer.processTx(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
    }

    //
    // Burn Consent
    //

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.BurnConsent memory transaction = RollupUtils.BurnConsentFromBytes(
            txBytes
        );
        return burnConsent.ApplyBurnConsentTx(_merkle_proof, transaction);
    }

    function processBurnConsentTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes memory sig,
        bytes memory txBytes,
        Types.PDAMerkleProof memory _from_pda_proof,
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
        Types.BurnConsent memory _tx = RollupUtils.BurnConsentFromBytes(
            txBytes
        );
        _tx.signature = sig;
        return
            burnConsent.processBurnConsentTx(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                _fromAccountProof
            );
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
        Types.BurnExecution memory _tx = RollupUtils.BurnExecutionFromBytes(
            txBytes
        );
        return
            burnExecution.processBurnExecutionTx(
                _balanceRoot,
                _tx,
                _fromAccountProof
            );
    }

    function processBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes[] memory _txs,
        bytes[] memory signatures,
        Types.BatchValidationProofs memory batchProofs,
        bytes32 expectedTxRoot,
        Types.Usage batchType
    )
        public
        view
        returns (
            bytes32,
            bytes32,
            bool
        )
    {
        if (batchType == Types.Usage.CreateAccount) {
            return
                createAccount.processCreateAccountBatch(
                    initialStateRoot,
                    accountsRoot,
                    _txs[0],
                    batchProofs,
                    expectedTxRoot
                );
        } else if (batchType == Types.Usage.Airdrop) {
            return
                airdrop.processAirdropBatch(
                    initialStateRoot,
                    accountsRoot,
                    _txs,
                    signatures,
                    batchProofs,
                    expectedTxRoot
                );
        } else if (batchType == Types.Usage.Transfer) {
            return
                transfer.processTransferBatch(
                    initialStateRoot,
                    accountsRoot,
                    _txs[0],
                    signatures,
                    batchProofs,
                    expectedTxRoot
                );
        } else if (batchType == Types.Usage.BurnConsent) {
            return
                burnConsent.processBurnConsentBatch(
                    initialStateRoot,
                    accountsRoot,
                    _txs[0],
                    signatures,
                    batchProofs,
                    expectedTxRoot
                );
        } else if (batchType == Types.Usage.BurnExecution) {
            return
                burnExecution.processBurnExecutionBatch(
                    initialStateRoot,
                    accountsRoot,
                    _txs[0],
                    batchProofs,
                    expectedTxRoot
                );
        } else {
            revert("Invalid BatchType to dispute");
        }
    }
}
