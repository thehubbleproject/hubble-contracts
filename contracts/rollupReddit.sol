pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {IReddit} from "./interfaces/IReddit.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Types} from "./libs/Types.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {RollupHelpers} from "./rollup.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";

contract RollupReddit is RollupHelpers {
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
        Types.DropTx memory transaction = RollupUtils.AirdropTxFromBytes(txBytes);
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

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(
        bytes[] calldata _txs,
        bytes32 _updatedRoot,
        Types.Usage batchType
    ) external payable onlyCoordinator isNotRollingBack {
        require(
            msg.value >= governance.STAKE_AMOUNT(),
            "Not enough stake committed"
        );

        require(
            _txs.length <= governance.MAX_TXS_PER_BATCH(),
            "Batch contains more transations than the limit"
        );
        bytes32 txRoot = merkleUtils.getMerkleRoot(_txs);
        require(
            txRoot != ZERO_BYTES32,
            "Cannot submit a transaction with no transactions"
        );
        addNewBatch(txRoot, _updatedRoot, batchType);
    }

    /**
     * @notice finalise deposits and submit batch
     */
    function finaliseDepositsAndSubmitBatch(
        uint256 _subTreeDepth,
        Types.AccountMerkleProof calldata _zero_account_mp
    ) external payable onlyCoordinator isNotRollingBack {
        bytes32 depositSubTreeRoot = depositManager.finaliseDeposits(
            _subTreeDepth,
            _zero_account_mp,
            getLatestBalanceTreeRoot()
        );
        // require(
        //     msg.value >= governance.STAKE_AMOUNT(),
        //     "Not enough stake committed"
        // );

        bytes32 updatedRoot = merkleUtils.updateLeafWithSiblings(
            depositSubTreeRoot,
            _zero_account_mp.accountIP.pathToAccount,
            _zero_account_mp.siblings
        );

        // add new batch
        addNewBatchWithDeposit(updatedRoot, depositSubTreeRoot);
    }
}
