pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {IReddit} from "./interfaces/IReddit.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Types} from "./libs/Types.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";

import {Transfer} from "./Transfer.sol";

contract RollupReddit {
    Registry public nameRegistry;
    IReddit public createAccount;
    IReddit public airdrop;
    IReddit public burnConsent;
    IReddit public burnExecution;

    Transfer public transfer;

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
    }

    //
    // CreateAccount
    //

    // TODO: should be routed to registry
    // function createPublickeys(bytes[] memory publicKeys) public returns (uint256[] memory) {
    //   return createAccount.createPublickeys(publicKeys);
    // }

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
        (bytes32 stateRoot11, uint256 safe) = transfer.processBatch(
            stateRoot0,
            txs,
            proofs
        );
        if (0 != safe) {
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
        Types.BurnConsent memory _tx = RollupUtils.BurnConsentTxFromBytes(
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
}
