pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Types} from "./libs/Types.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {ECVerify} from "./libs/ECVerify.sol";
import {IncrementalTree} from "./IncrementalTree.sol";
import {Logger} from "./logger.sol";
import {POB} from "./POB.sol";
import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {Governance} from "./Governance.sol";
import {DepositManager} from "./DepositManager.sol";


contract RollupSetup {
    using SafeMath for uint256;
    using BytesLib for bytes;
    using ECVerify for bytes32;

    /*********************
     * Variable Declarations *
     ********************/

    // External contracts
    DepositManager public depositManager;
    IncrementalTree public accountsTree;
    Logger public logger;
    ITokenRegistry public tokenRegistry;
    Registry public nameRegistry;
    Types.Batch[] public batches;
    MTUtils public merkleUtils;

    bytes32 public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;
    address payable constant BURN_ADDRESS = 0x0000000000000000000000000000000000000000;
    Governance public governance;

    // this variable will be greater than 0 if
    // there is rollback in progress
    // will be reset to 0 once rollback is completed
    uint256 public invalidBatchMarker;

    /*********************
     * Error Codes *
    ********************/
    uint public constant NO_ERR = 0;
    uint public constant ERR_TOKEN_ADDR_INVAILD = 1;  // account doesnt hold token type in the tx
    uint public constant ERR_TOKEN_AMT_INVAILD = 2; // tx amount is less than zero
    uint public constant ERR_TOKEN_NOT_ENOUGH_BAL = 3; // leaf doesnt has enough balance
    uint public constant ERR_FROM_TOKEN_TYPE = 4; // from account doesnt hold the token type in the tx
    uint public constant ERR_TO_TOKEN_TYPE = 5; // to account doesnt hold the token type in the tx

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.POB())
        );
        assert(msg.sender == pobContract.getCoordinator());
        _;
    }

    modifier isNotWaitingForFinalisation() {
        assert(!depositManager.isDepositPaused());
        _;
    }

    modifier isNotRollingBack() {
        assert(invalidBatchMarker == 0);
        _;
    }

    modifier isRollingBack() {
        assert(invalidBatchMarker > 0);
        _;
    }
}

contract RollupHelpers is RollupSetup {
    /**
     * @notice Returns the latest state root
     */
    function getLatestBalanceTreeRoot() public view returns (bytes32) {
        return batches[batches.length - 1].stateRoot;
    }

    /**
     * @notice Returns the total number of batches submitted
     */
    function numOfBatchesSubmitted() public view returns (uint256) {
        return batches.length;
    }

    function addNewBatch(bytes32 txRoot, bytes32 _updatedRoot) internal {
        Types.Batch memory newBatch = Types.Batch({
            stateRoot: _updatedRoot,
            accountRoot: accountsTree.getTreeRoot(),
            depositTree: ZERO_BYTES32,
            committer: msg.sender,
            txRoot: txRoot,
            stakeCommitted: msg.value,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            timestamp: now
        });

        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            txRoot,
            _updatedRoot,
            batches.length - 1
        );
    }

    function addNewBatchWithDeposit(bytes32 _updatedRoot, bytes32 depositRoot)
        internal
    {
        Types.Batch memory newBatch = Types.Batch({
            stateRoot: _updatedRoot,
            accountRoot: accountsTree.getTreeRoot(),
            depositTree: depositRoot,
            committer: msg.sender,
            txRoot: ZERO_BYTES32,
            stakeCommitted: msg.value,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            timestamp: now
        });

        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            ZERO_BYTES32,
            _updatedRoot,
            batches.length - 1
        );
    }

    function RemoveTokensFromAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return
           (
                RollupUtils.UpdateBalanceInAccount(
                    account,
                    RollupUtils.BalanceFromAccount(account).sub(numOfTokens)
                )
            );
    }

    function AddTokensToAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return
            (
                RollupUtils.UpdateBalanceInAccount(
                    account,
                    RollupUtils.BalanceFromAccount(account).add(numOfTokens)
                )
            );
    }

    /**
     * @notice Returns the batch
     */
    function getBatch(uint _batch_id) public view returns (Types.Batch memory batch) {
        require(
            batches.length - 1 >= _batch_id,
            "Batch id greater than total number of batches, invalid batch id"
            );
        batch = batches[_batch_id];
    }

    /**
     * @notice Returns the updated root and balance
     */
    function UpdateAccountWithSiblings(
        Types.UserAccount memory new_account,
        Types.AccountMerkleProof memory _merkle_proof
    ) public view returns(bytes32, uint) {
        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(new_account)),
            _merkle_proof.accountIP.pathToAccount,
            _merkle_proof.siblings
        );
        uint balance = RollupUtils.BalanceFromAccount(new_account);
        return (newRoot, balance);
    }

    function validateTxBasic(
        Types.Transaction memory _tx,
        Types.UserAccount memory _from_account 
    ) public view returns(uint) {
        // verify that tokens are registered
        if (tokenRegistry.registeredTokens(_tx.tokenType) == address(0)) {
            // invalid state transition
            // to be slashed because the submitted transaction
            // had invalid token type
            return ERR_TOKEN_ADDR_INVAILD;
        }

        if (_tx.amount < 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had amount less than 0
            return ERR_TOKEN_AMT_INVAILD;
        }

        // check from leaf has enough balance
        if (_from_account.balance < _tx.amount) {
            // invalid state transition
            // needs to be slashed because the account doesnt have enough balance
            // for the transfer
            return ERR_TOKEN_NOT_ENOUGH_BAL;
        }

        return NO_ERR;
    }

    function ValidatePubkeyAvailability(
        bytes32 _accountsRoot,
        Types.PDAMerkleProof memory _from_pda_proof,
        uint256 from_index
    ) public view {
        // verify from account pubkey exists in PDA tree
        // NOTE: We dont need to prove that to address has the pubkey available
        Types.PDALeaf memory fromPDA = Types.PDALeaf({
            pubkey: _from_pda_proof._pda.pubkey_leaf.pubkey
        });

        require(
            merkleUtils.verifyLeaf(
                _accountsRoot,
                RollupUtils.PDALeafToHash(fromPDA),
                _from_pda_proof._pda.pathToPubkey,
                _from_pda_proof.siblings
            ),
            "From PDA proof is incorrect"
        );

        // convert pubkey path to ID
        uint256 computedID = merkleUtils.pathToIndex(
            _from_pda_proof._pda.pathToPubkey,
            governance.MAX_DEPTH()
        );

        // make sure the ID in transaction is the same account for which account proof was provided
        require(
            computedID == from_index,
            "Pubkey not related to the from account in the transaction"
        );
    }

    function ValidateSignature(
        Types.Transaction memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof
    ) public view returns(bool) {
        require(
            RollupUtils.calculateAddress(
                _from_pda_proof._pda.pubkey_leaf.pubkey
            ) ==
                RollupUtils
                    .getTxHash(
                    _tx
                        .fromIndex,
                    _tx
                        .toIndex,
                    _tx
                        .tokenType,
                    _tx
                        .amount
                )
                    .ecrecovery(_tx.signature),
            "Signature is incorrect"
        );
    }

    function ValidateAccountMP(
        bytes32 root,
        Types.AccountMerkleProof memory merkle_proof
    ) public view {
        bytes32 accountLeaf = RollupUtils.getAccountHash(
            merkle_proof.accountIP.account.ID,
            merkle_proof.accountIP.account.balance,
            merkle_proof.accountIP.account.nonce,
            merkle_proof.accountIP.account.tokenType
        );

        // verify from leaf exists in the balance tree
        require(
            merkleUtils.verifyLeaf(
                root,
                accountLeaf,
                merkle_proof.accountIP.pathToAccount,
                merkle_proof.siblings
            ),
            "Merkle Proof is incorrect"
        );
    }

     /**
     * @notice SlashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challengers. Also deletes all the batches after invalid batch
     */
    function SlashAndRollback() public isRollingBack {
        uint256 challengerRewards = 0;
        uint256 burnedAmount = 0;
        uint256 totalSlashings = 0;

        for (uint256 i = batches.length - 1; i >= invalidBatchMarker; i--) {
            // if gas left is low we would like to do all the transfers
            // and persist intermediate states so someone else can send another tx
            // and rollback remaining batches
            if (gasleft() <= governance.MIN_GAS_LIMIT_LEFT()) {
                // exit loop gracefully
                break;
            }

            if (i == invalidBatchMarker) {
                // we have completed rollback
                // update the marker
                invalidBatchMarker = 0;
            }

            // load batch
            Types.Batch memory batch = batches[i];

            // TODO use safe math
            // calculate challeger's reward
            challengerRewards += (batch.stakeCommitted * 2) / 3;
            burnedAmount += batch.stakeCommitted.sub(challengerRewards);

            batches[i].stakeCommitted = 0;

            // delete batch
            delete batches[i];

            totalSlashings++;
            logger.logBatchRollback(
                i,
                batch.committer,
                batch.stateRoot,
                batch.txRoot,
                batch.stakeCommitted
            );
        }

        // TODO add deposit rollback

        // transfer reward to challenger
        (msg.sender).transfer(challengerRewards);

        // burn the remaning amount
        (BURN_ADDRESS).transfer(burnedAmount);

        // resize batches length
        batches.length = batches.length.sub(invalidBatchMarker.sub(1));

        logger.logRollbackFinalisation(totalSlashings);
    }
}


contract Rollup is RollupHelpers {
    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr, bytes32 genesisStateRoot) public {
        nameRegistry = Registry(_registryAddr);

        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.DEPOSIT_MANAGER())
        );

        governance = Governance(
            nameRegistry.getContractDetails(ParamManager.Governance())
        );
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        accountsTree = IncrementalTree(
            nameRegistry.getContractDetails(ParamManager.ACCOUNTS_TREE())
        );

        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        addNewBatch(ZERO_BYTES32, genesisStateRoot);
    }

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(bytes[] calldata _txs, bytes32 _updatedRoot)
        external
        onlyCoordinator
        isNotRollingBack
        payable
    {
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
        addNewBatch(txRoot, _updatedRoot);
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

    /**
     *  disputeBatch processes a transactions and returns the updated balance tree
     *  and the updated leaves.
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function disputeBatch(
        uint256 _batch_id,
        Types.Transaction[] memory _txs,
        Types.AccountMerkleProof[] memory _from_proofs,
        Types.PDAMerkleProof[] memory _pda_proof,
        Types.AccountMerkleProof[] memory _to_proofs
    ) public {
        {
        // load batch
        require(
            batches[_batch_id].stakeCommitted != 0,
            "Batch doesnt exist or is slashed already"
        );

        // check if batch is disputable
        require(
            block.number < batches[_batch_id].finalisesOn,
            "Batch already finalised"
        );

        require(
            _batch_id < invalidBatchMarker,
            "Already successfully disputed. Roll back in process"
        );

        require(
            batches[_batch_id].txRoot != ZERO_BYTES32,
            "Cannot dispute blocks with no transaction"
        );

        // generate merkle tree from the txs provided by user
        bytes[] memory txs;
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = RollupUtils.CompressTx(_txs[i]);
        }
        bytes32 txRoot = merkleUtils.getMerkleRoot(txs);

        // if tx root while submission doesnt match tx root of given txs
        // dispute is unsuccessful
        require(
            txRoot != batches[_batch_id].txRoot,
            "Invalid dispute, tx root doesn't match"
        );
        }

        // run every transaction through transaction evaluators
        bytes32 newBalanceRoot;
        uint256 fromBalance;
        uint256 toBalance;
        bool isTxValid;

        // start with false state
        bool isDisputeValid = false;

        for (uint256 i = 0; i < _txs.length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (newBalanceRoot, fromBalance, toBalance, isTxValid) = processTx(
                batches[_batch_id - 1].stateRoot,
                batches[_batch_id - 1].accountRoot,
                _txs[i],
                _pda_proof[i],
                _from_proofs[i],
                _to_proofs[i]
            );
            if (!isTxValid) {
                isDisputeValid = true;
                break;
            }
        }

        // dispute is valid, we need to slash and rollback :(
        if (isDisputeValid) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = _batch_id;
            SlashAndRollback();
            return;
        }

        // if new root doesnt match what was submitted by coordinator
        // slash and rollback
        if (newBalanceRoot != batches[_batch_id].stateRoot) {
            invalidBatchMarker = _batch_id;
            SlashAndRollback();
            return;
        }
    }

    /**
     * @notice processTx processes a transactions and returns the updated balance tree
     *  and the updated leaves
     * conditions in require mean that the dispute be declared invalid
     * if conditons evaluate if the coordinator was at fault
     * @return Total number of batches submitted onchain
     */
    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.Transaction memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountMerkleProof memory _from_merkle_proof,
        Types.AccountMerkleProof memory _to_merkle_proof
    )
        public
        view
        returns (
            bytes32,
            uint256,
            uint256,
            bool
        )
    {
        // Step-1 Prove that from address's public keys are available
        ValidatePubkeyAvailability(_accountsRoot, _from_pda_proof, _tx.fromIndex);

        // STEP:2 Ensure the transaction has been signed using the from public key
        // ValidateSignature(_tx, _from_pda_proof);

        // Validate the from account merkle proof
        ValidateAccountMP(_balanceRoot, _from_merkle_proof);

        (uint err_code) = validateTxBasic(_tx,
                                          _from_merkle_proof.accountIP.account);
        if(err_code != NO_ERR) return (ZERO_BYTES32, 0, err_code, false);

        Types.UserAccount memory new_from_account = RemoveTokensFromAccount(
            _from_merkle_proof.accountIP.account,
            _tx.amount
        );

        // account holds the token type in the tx
        if (_from_merkle_proof.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, ERR_FROM_TOKEN_TYPE, false);

        (bytes32 newFromRoot, uint from_new_balance) = UpdateAccountWithSiblings(
            new_from_account,
            _from_merkle_proof
        );

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(newFromRoot, _to_merkle_proof);

        Types.UserAccount memory new_to_account = AddTokensToAccount(
            _to_merkle_proof.accountIP.account,
            _tx.amount
        );

        // account holds the token type in the tx
        if (_to_merkle_proof.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, ERR_FROM_TOKEN_TYPE, false);

        (bytes32 newToRoot, uint to_new_balance) = UpdateAccountWithSiblings(
            new_to_account,
            _to_merkle_proof
        );

        return (
            newToRoot,
            from_new_balance,
            to_new_balance,
            true
        );
    }

    /**
     * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
     * @param batch_id Batch ID that the coordinator submitted
     */
    // function WithdrawStake(uint256 batch_id) public {
    //     Types.Batch memory committedBatch = batches[batch_id];
    //     require(
    //         msg.sender == committedBatch.committer,
    //         "You are not the correct committer for this batch"
    //     );
    //     require(
    //         block.number > committedBatch.finalisesOn,
    //         "This batch is not yet finalised, check back soon!"
    //     );
    //     msg.sender.transfer(committedBatch.stakeCommitted);
    //     logger.logStakeWithdraw(
    //         msg.sender,
    //         committedBatch.stakeCommitted,
    //         batch_id
    //     );
    // }
}
