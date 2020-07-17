pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {IReddit} from "./interfaces/IReddit.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Types} from "./libs/Types.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";

contract RollupReddit {
    Registry public nameRegistry;
    IReddit public createAccount;
    IReddit public airdrop;
    IReddit public burnConsent;
    IReddit public burnExecution;
    IReddit public transfer;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        createAccount = IReddit(
            nameRegistry.getContractDetails(ParamManager.CREATE_ACCOUNT())
        );

        airdrop = IReddit(
            nameRegistry.getContractDetails(ParamManager.AIRDROP())
        );
        burnConsent = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_CONSENT())
        );
        burnExecution = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_EXECUTION())
        );
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
        Types.DropTx memory _tx = RollupUtils.AirdropTxFromBytes(txBytes);
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

    function ApplyAirdropTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        Types.DropTx memory transaction = RollupUtils.AirdropTxFromBytes(
            txBytes
        );
        return airdrop.ApplyAirdropTx(_merkle_proof, transaction);
    }

    function ApplyTransferTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes
    ) public view returns (bytes memory, bytes32 newRoot) {
        Types.Transaction memory transaction = RollupUtils.TxFromBytes(txBytes);
        return transfer.ApplyTx(_merkle_proof, transaction);
    }

    /**
     * @notice processTx processes a transactions and returns the updated balance tree
     *  and the updated leaves
     * conditions in require mean that the dispute be declared invalid
     * if conditons evaluate if the coordinator was at fault
     * @return Total number of batches submitted onchain
     */
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

    function processTxBurnConsent(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnConsent memory _tx,
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
        return
            burnConsent.processTxBurnConsent(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
    }

    function processTxBurnExecution(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnExecution memory _tx,
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
        return
            burnExecution.processTxBurnExecution(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
    }
}
