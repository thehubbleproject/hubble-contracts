pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {Logger} from "./logger.sol";
import {Tree} from "./Tree.sol";
import {IncrementalTree} from "./IncrementalTree.sol";

import {MerkleTreeLib} from "./libs/MerkleTreeLib.sol";
import {DataTypes as dataTypes} from "./DataTypes.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import {ECVerify} from "./ECVerify.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";


// Main rollup contract
contract Rollup {
    using SafeMath for uint256;
    using BytesLib for bytes;
    using ECVerify for bytes32;

    uint256 public MAX_DEPTH = 10;
    uint256 constant MAX_TXS_PER_BATCH = 10;
    uint256 public STAKE_AMOUNT = 32;
    address payable BURN_ADDRESS = 0x0000000000000000000000000000000000000000;
    bytes32 public ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    address coordinator;

    // finalisation time is the number of blocks required by a batch to finalise
    // Delay period = 7 days. Block time = 15 seconds
    uint256 TIME_TO_FINALISE = 40320;

    // min gas required before rollback pauses
    uint256 MIN_GAS_LIMIT_LEFT = 100000;
    /*********************
     * Variable Declarations *
     ********************/

    // External contracts
    MerkleTreeLib public merkleTreeLib;
    Tree public balancesTree;
    IncrementalTree public accountsTree;

    Logger public logger;

    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;

    dataTypes.Batch[] public batches;

    // Stores transaction paths claimed per batch
    // TO BE REMOVED post withdraw mass migration
    bool[][MAX_TXS_PER_BATCH] withdrawTxClaimed;

    // this variable will be greater than 0 if
    // there is rollback in progress
    // will be reset to 0 once rollback is completed
    uint256 invalidBatchMarker;

    modifier onlyCoordinator() {
        assert(msg.sender == coordinator);
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

    /*********************
     * Constructor *
     ********************/
    constructor(
        address _balancesTree,
        address _accountsTree,
        address _merkleTreeLib,
        address _tokenRegistryAddr,
        address _logger,
        address _coordinator
    ) public {
        merkleTreeLib = MerkleTreeLib(_merkleTreeLib);
        balancesTree = Tree(_balancesTree);
        accountsTree = IncrementalTree(_accountsTree);
        tokenRegistry = ITokenRegistry(_tokenRegistryAddr);
        logger = Logger(_logger);
        coordinator = _coordinator;
    }

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(bytes[] calldata _txs, bytes32 _updatedRoot)
        external
        payable
        onlyCoordinator
        isNotRollingBack
    {
        require(
            msg.value == STAKE_AMOUNT,
            "Please send 32 eth with batch as stake"
        );
        if (_txs.length > MAX_TXS_PER_BATCH) {}

        require(
            _txs.length <= MAX_TXS_PER_BATCH,
            "Batch contains more transations than the limit"
        );
        bytes32 txRoot = merkleTreeLib.getMerkleRoot(_txs);

        // TODO need to commit the depths of all trees as well, because they are variable depth
        // make merkel root of all txs
        dataTypes.Batch memory newBatch = dataTypes.Batch({
            stateRoot: _updatedRoot,
            accountRoot: accountsTree.getTreeRoot(),
            committer: msg.sender,
            txRoot: txRoot,
            stakeCommitted: msg.value,
            finalisesOn: block.number + TIME_TO_FINALISE,
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

    /**
     *  disputeBatch processes a transactions and returns the updated balance tree
     *  and the updated leaves.
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function disputeBatch(
        uint256 _batch_id,
        dataTypes.Transaction[] memory _txs,
        dataTypes.AccountMerkleProof[] memory _from_proofs,
        dataTypes.PDAMerkleProof[] memory _pda_proof,
        dataTypes.AccountMerkleProof[] memory _to_proofs
    ) public {
        // load batch
        // dataTypes.Batch memory disputed_batch = batches[_batch_id];
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

        // generate merkle tree from the txs provided by user
        bytes[] memory txs;
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = BytesFromTx(_txs[i]);
        }
        bytes32 txRoot = merkleTreeLib.getMerkleRoot(txs);

        // if tx root while submission doesnt match tx root of given txs
        // dispute is unsuccessful
        require(
            txRoot != batches[_batch_id].txRoot,
            "Invalid dispute, tx root doesn't match"
        );

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
                batches[_batch_id].stateRoot,
                batches[_batch_id].accountRoot,
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
        dataTypes.Transaction memory _tx,
        dataTypes.PDAMerkleProof memory _pda_proof,
        dataTypes.AccountMerkleProof memory _from_merkle_proof,
        dataTypes.AccountMerkleProof memory _to_merkle_proof
    ) public returns (bytes32, uint256, uint256, bool) {
        // verify pubkey exists in PDA tree
        require(
            merkleTreeLib.verify(
                _accountsRoot,
                _pda_proof._pda.pubkey_leaf.pubkey,
                _pda_proof._pda.pathToPubkey,
                _pda_proof.siblings
            ),
            "The PDA proof is incorrect"
        );

        // convert pubkey path to ID
        uint256 computedID = merkleTreeLib.pathToIndex(
            _pda_proof._pda.pathToPubkey,
            MAX_DEPTH
        );

        require(
            computedID == _tx.from.ID,
            "Pubkey not related to the from account in the transaction"
        );

        require(
            calculateAddress(_pda_proof._pda.pubkey_leaf.pubkey) ==
                HashFromTx(_tx).ecrecovery(_tx.signature),
            "Signature is incorrect"
        );

        // check token type is registered
        if (tokenRegistry.registeredTokens(_tx.tokenType) == address(0)) {
            // invalid state transition
            // to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, 0, false);
        }

        // verify from leaf exists in the balance tree
        require(
            merkleTreeLib.verify(
                _balanceRoot,
                BytesFromAccount(_tx.from),
                _from_merkle_proof.accountIP.pathToAccount,
                _from_merkle_proof.siblings
            ),
            "Merkle Proof for from leaf is incorrect"
        );

        if (_tx.amount < 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had amount less than 0
            return (ZERO_BYTES32, 0, 0, false);
        }

        // check from leaf has enough balance
        if (_from_merkle_proof.accountIP.account.balance < _tx.amount) {
            // invalid state transition
            // needs to be slashed because the account doesnt have enough balance
            // for the transfer
            return (ZERO_BYTES32, 0, 0, false);
        }

        // account holds the token type in the tx
        if (_from_merkle_proof.accountIP.account.tokenType != _tx.tokenType) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, 0, false);
        }

        // reduce balance of from leaf
        dataTypes.UserAccount memory new_from_leaf = UpdateBalanceInAccount(
            _from_merkle_proof.accountIP.account,
            BalanceFromAccount(_from_merkle_proof.accountIP.account).sub(
                _tx.amount
            )
        );

        bytes32 newRoot = merkleTreeLib.updateLeafWithSiblings(
            keccak256(BytesFromAccount(new_from_leaf)),
            _from_merkle_proof.accountIP.pathToAccount,
            _from_merkle_proof.siblings
        );

        // verify to leaf exists in the balance tree
        require(
            merkleTreeLib.verify(
                newRoot,
                BytesFromAccount(_tx.to),
                _to_merkle_proof.accountIP.pathToAccount,
                _to_merkle_proof.siblings
            ),
            "Merkle Proof for from leaf is incorrect"
        );

        // account holds the token type in the tx
        if (_to_merkle_proof.accountIP.account.tokenType != _tx.tokenType) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, 0, false);
        }

        // increase balance of to leaf
        dataTypes.UserAccount memory new_to_leaf = UpdateBalanceInAccount(
            _to_merkle_proof.accountIP.account,
            BalanceFromAccount(_to_merkle_proof.accountIP.account).add(
                _tx.amount
            )
        );

        // update the merkle tree
        balancesTree.update(
            BytesFromAccount(new_to_leaf),
            _to_merkle_proof.accountIP.pathToAccount
        );
        newRoot = merkleTreeLib.updateLeafWithSiblings(
            keccak256(BytesFromAccount(new_to_leaf)),
            _to_merkle_proof.accountIP.pathToAccount,
            _to_merkle_proof.siblings
        );

        return (
            newRoot,
            BalanceFromAccount(new_from_leaf),
            BalanceFromAccount(new_to_leaf),
            true
        );
    }

    /**
     * @notice SlashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challegers. Also deletes all the batches after invalid batch
     */
    function SlashAndRollback() public isRollingBack {
        uint256 challengerRewards = 0;
        uint256 burnedAmount = 0;
        uint256 totalSlashings = 0;

        for (uint256 i = batches.length - 1; i >= invalidBatchMarker; i--) {
            // if gas left is low we would like to do all the transfers
            // and persist intermediate states so someone else can send another tx
            // and rollback remaining batches
            if (gasleft() <= MIN_GAS_LIMIT_LEFT) {
                // exit loop gracefully
                break;
            }

            if (i == invalidBatchMarker) {
                // we have completed rollback
                // update the marker
                invalidBatchMarker = 0;
            }

            // load batch
            dataTypes.Batch memory batch = batches[i];

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

    /**
     * @notice Allows user to withdraw the balance in the leaf of the balances tree.
     *        User has to do the following: Prove that a transfer of X tokens was made to the burn address or leaf 0
     *        The batch we are allowing withdraws from should have been already finalised, so we can assume all data in the batch to be correct
     * @param _batch_id Deposit tree depth or depth of subtree that is being deposited
     * @param withdraw_tx_proof contains the siblints, txPath and the txData for the withdraw transaction
     */
    function Withdraw(
        uint256 _batch_id,
        dataTypes.PDAMerkleProof memory _pda_proof,
        dataTypes.TransactionMerkleProof memory withdraw_tx_proof
    ) public {
        // make sure the batch id is valid
        require(
            batches.length - 1 >= _batch_id,
            "Batch id greater than total number of batches, invalid batch id"
        );

        dataTypes.Batch memory batch = batches[_batch_id];

        // check if the batch is finalised
        require(block.number > batch.finalisesOn, "Batch not finalised yet");

        // verify transaction exists in the batch
        merkleTreeLib.verify(
            batch.txRoot,
            BytesFromTx(withdraw_tx_proof._tx.data),
            withdraw_tx_proof._tx.pathToTx,
            withdraw_tx_proof.siblings
        );

        // check if the transaction is withdraw transaction
        // ensure the `to` leaf was the 0th leaf
        require(
            withdraw_tx_proof._tx.data.to.ID == 0,
            "Not a withdraw transaction"
        );

        bool isClaimed = withdrawTxClaimed[_batch_id][withdraw_tx_proof
            ._tx
            .pathToTx];
        require(!isClaimed, "Withdraw transaction already claimed");
        withdrawTxClaimed[_batch_id][withdraw_tx_proof._tx.pathToTx] = true;

        // withdraw checks out, transfer to the account in account tree
        address tokenContractAddress = tokenRegistry.registeredTokens(
            withdraw_tx_proof._tx.data.tokenType
        );

        //TODO get account address from PDA tree

        // convert pubkey path to ID
        // TODO replace MAX_DEPTH with the committed depth
        uint256 computedID = merkleTreeLib.pathToIndex(
            _pda_proof._pda.pathToPubkey,
            MAX_DEPTH
        );

        require(
            computedID == withdraw_tx_proof._tx.data.from.ID,
            "Pubkey not related to the from account in the transaction"
        );

        address receiver = calculateAddress(_pda_proof._pda.pubkey_leaf.pubkey);
        require(
            receiver ==
                HashFromTx(withdraw_tx_proof._tx.data).ecrecovery(
                    withdraw_tx_proof._tx.data.signature
                ),
            "Signature is incorrect"
        );

        uint256 amount = withdraw_tx_proof._tx.data.amount;

        tokenContract = IERC20(tokenContractAddress);
        require(tokenContract.transfer(receiver, amount), "Unable to trasnfer");
    }

    /**
     * @notice Merges the deposit tree with the balance tree by
     *        superimposing the deposit subtree on the balance tree
     * @param _subTreeDepth Deposit tree depth or depth of subtree that is being deposited
     * @param _zero_account_mp Merkle proof proving the node at which we are inserting the deposit subtree consists of all empty leaves
     * @return Updates in-state merkle tree root
     */
    function finaliseDeposits(
        uint256 _subTreeDepth,
        dataTypes.AccountMerkleProof memory _zero_account_mp
    ) public onlyCoordinator returns (bytes32) {
        bytes32 emptySubtreeRoot = merkleTreeLib.getRoot(_subTreeDepth);

        // from mt proof we find the root of the tree
        // we match the root to the balance tree root on-chain
        require(
            merkleTreeLib.verifyLeaf(
                getBalanceTreeRoot(),
                emptySubtreeRoot,
                _zero_account_mp.accountIP.pathToAccount,
                _zero_account_mp.siblings
            ),
            "proof invalid"
        );

        // update the in-state balance tree with new leaf from pendingDeposits[0]
        balancesTree.updateLeaf(
            pendingDeposits[0],
            _zero_account_mp.accountIP.pathToAccount
        );

        // removed the root at pendingDeposits[0] because it has been added to the balance tree
        removeDeposit(0);

        // update the number of elements present in the queue
        queueNumber = queueNumber - 2**depositSubtreeHeight;

        // return the updated merkle tree root
        return getBalanceTreeRoot();
    }

    /**
     * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
     * @param batch_id Batch ID that the coordinator submitted
     */
    function WithdrawStake(uint256 batch_id) public {
        dataTypes.Batch memory committedBatch = batches[batch_id];
        require(
            msg.sender == committedBatch.committer,
            "You are not the correct committer for this batch"
        );
        require(
            block.number > committedBatch.finalisesOn,
            "This batch is not yet finalised, check back soon!"
        );
        msg.sender.transfer(committedBatch.stakeCommitted);
        logger.logStakeWithdraw(
            msg.sender,
            committedBatch.stakeCommitted,
            batch_id
        );
    }
}
