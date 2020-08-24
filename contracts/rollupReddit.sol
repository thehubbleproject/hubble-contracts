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
        bytes memory txs = RollupUtils.CompressCreateAccountFromEncoded(
            txBytes
        );
        return createAccount.ApplyCreateAccountTx(_merkle_proof, txs, 0);
    }

    function processCreateAccountTx(
        bytes32 _balanceRoot,
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
        bytes memory txs = RollupUtils.CompressCreateAccountFromEncoded(
            txBytes
        );
        return
            createAccount.processCreateAccountTx(
                _balanceRoot,
                txs,
                0,
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
        bytes memory txs = RollupUtils.CompressAirdropFromEncoded(txBytes, sig);
        // Validate ECDSA sig
        return
            airdrop.processAirdropTx(
                _balanceRoot,
                txs,
                0,
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
        bytes memory emptySig = new bytes(65);
        bytes memory txs = RollupUtils.CompressTransferFromEncoded(
            txBytes,
            emptySig
        );
        return transfer.ApplyTransferTx(_merkle_proof, txs, 0);
    }

    function processTransferTx(
        bytes32 _balanceRoot,
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
        bytes memory txs = RollupUtils.CompressTransferFromEncoded(
            txBytes,
            sig
        );
        // Validate ECDSA sig
        return
            transfer.processTx(
                _balanceRoot,
                txs,
                0,
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
        bytes memory txs = RollupUtils.CompressBurnConsentFromEncoded(txBytes);
        return burnConsent.ApplyBurnConsentTx(_merkle_proof, txs, 0);
    }

    function processBurnConsentTx(
        bytes32 _balanceRoot,
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
        bytes memory txs = RollupUtils.CompressBurnConsentFromEncoded(txBytes);
        return
            burnConsent.processBurnConsentTx(
                _balanceRoot,
                txs,
                0,
                _from_pda_proof,
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

    function processBatch(
        bytes32 initialStateRoot,
        bytes memory txs,
        Types.BatchValidationProofs memory batchProofs,
        bytes32 expectedTxHashCommitment,
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
                    txs,
                    batchProofs,
                    expectedTxHashCommitment
                );
        } else if (batchType == Types.Usage.Airdrop) {
            return
                airdrop.processAirdropBatch(
                    initialStateRoot,
                    txs,
                    batchProofs,
                    expectedTxHashCommitment
                );
        } else if (batchType == Types.Usage.Transfer) {
            return
                transfer.processTransferBatch(
                    initialStateRoot,
                    txs,
                    batchProofs,
                    expectedTxHashCommitment
                );
        } else if (batchType == Types.Usage.BurnConsent) {
            return
                burnConsent.processBurnConsentBatch(
                    initialStateRoot,
                    txs,
                    batchProofs,
                    expectedTxHashCommitment
                );
        } else if (batchType == Types.Usage.BurnExecution) {
            return
                burnExecution.processBurnExecutionBatch(
                    initialStateRoot,
                    txs,
                    batchProofs,
                    expectedTxHashCommitment
                );
        } else {
            revert("Invalid BatchType to dispute");
        }
    }
}
