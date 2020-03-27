pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {Logger} from "./logger.sol";

import {MerkleTree} from "./MerkleTree.sol";
import {MerkleTreeLib} from "./libs/MerkleTreeLib.sol";

import {DataTypes as dataTypes} from "./DataTypes.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import {ECVerify} from "./ECVerify.sol";


// token registry contract interface
contract ITokenRegistry {
    address public Coordinator;
    uint256 public numTokens;
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) public registeredTokens;

    modifier onlyCoordinator() {
        assert(msg.sender == Coordinator);
        _;
    }

    function requestTokenRegistration(address tokenContract) public {}

    function finaliseTokenRegistration(address tokenContract) public {}
}


// ERC20 token interface
contract IERC20 {
    function transferFrom(address from, address to, uint256 value)
        public
        returns (bool)
    {}

    function transfer(address recipient, uint256 value) public returns (bool) {}
}


// Main rollup contract
contract Rollup {
    using SafeMath for uint256;
    using BytesLib for bytes;
    using ECVerify for bytes32;

    uint256 MAX_DEPTH;
    uint256 STAKE_AMOUNT = 32;
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
    MerkleTree public balancesTree;
    MerkleTree public accountsTree;

    Logger public logger;

    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;

    dataTypes.Batch[] public batches;

    bytes32[] public pendingDeposits;
    uint256 public queueNumber;
    uint256 public depositSubtreeHeight;

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
        balancesTree = MerkleTree(_balancesTree);
        accountsTree = MerkleTree(_accountsTree);
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
        bytes32 txRoot = merkleTreeLib.getMerkleRoot(_txs);

        // make merkel root of all txs
        dataTypes.Batch memory newBatch = dataTypes.Batch({
            stateRoot: _updatedRoot,
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
        dataTypes.AccountMerkleProof[] memory _to_proofs
    ) public {
        // load batch
        dataTypes.Batch memory disputed_batch = batches[_batch_id];
        require(
            disputed_batch.stakeCommitted != 0,
            "Batch doesnt exist or is slashed already"
        );

        // check if batch is disputable
        require(
            block.number < disputed_batch.finalisesOn,
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
            txRoot != disputed_batch.txRoot,
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
                _txs[i],
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
        if (newBalanceRoot != disputed_batch.stateRoot) {
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
        dataTypes.Transaction memory _tx,
        dataTypes.AccountMerkleProof memory _from_merkle_proof,
        dataTypes.AccountMerkleProof memory _to_merkle_proof
    ) public returns (bytes32, uint256, uint256, bool) {
        // check signature on the tx is correct
        // TODO fix after adding account tree
        // require(IdToAccounts[_tx.from.path] == getTxBytesHash(_tx).ecrecovery(_tx.signature),"Signature is incorrect");

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
            _balanceRoot,
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
            newRoot,
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
     * @notice Adds a deposit for the msg.sender to the deposit queue
     * @param _amount Number of tokens that user wants to deposit
     * @param _tokenType Type of token user is depositing
     */
    function deposit(uint256 _amount, uint256 _tokenType, bytes memory _pubkey)
        public
    {
        depositFor(msg.sender, _amount, _tokenType, _pubkey);
    }

    /**
     * @notice Adds a deposit for an address to the deposit queue
     * @param _destination Address for which we are depositing
     * @param _amount Number of tokens that user wants to deposit
     * @param _tokenType Type of token user is depositing
     */
    function depositFor(
        address _destination,
        uint256 _amount,
        uint256 _tokenType,
        bytes memory _pubkey
    ) public {
        // check amount is greater than 0
        require(_amount > 0, "token deposit must be greater than 0");

        // ensure public matches the destination address
        require(
            _destination == calculateAddress(_pubkey),
            "public key and address don't match"
        );

        // check token type exists
        address tokenContractAddress = tokenRegistry.registeredTokens(
            _tokenType
        );
        tokenContract = IERC20(tokenContractAddress);

        // transfer from msg.sender to this contract
        require(
            tokenContract.transferFrom(msg.sender, address(this), _amount),
            "token transfer not approved"
        );

        // create a new account
        dataTypes.UserAccount memory newAccount;
        newAccount.balance = _amount;
        newAccount.tokenType = _tokenType;
        newAccount.nonce = 0;

        //TODO add pubkey to the accounts tree

        // get new account hash
        bytes32 accountHash = HashFromAccount(newAccount);

        // queue the deposit
        pendingDeposits.push(accountHash);

        // emit the event
        logger.logDepositQueued(
            1,
            _destination,
            _amount,
            _tokenType,
            accountHash,
            _pubkey
        );

        queueNumber++;
        uint256 tmpDepositSubtreeHeight = 0;
        uint256 tmp = queueNumber;
        while (tmp % 2 == 0) {
            bytes32[] memory deposits = new bytes32[](2);
            deposits[0] = pendingDeposits[pendingDeposits.length - 2];
            deposits[1] = pendingDeposits[pendingDeposits.length - 1];

            pendingDeposits[pendingDeposits.length - 2] = getDepositsHash(
                deposits[0],
                deposits[1]
            );
            removeDeposit(pendingDeposits.length - 1);
            tmp = tmp / 2;
            tmpDepositSubtreeHeight++;
        }
        if (tmpDepositSubtreeHeight > depositSubtreeHeight) {
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }
    }

    /**
     * @notice Allows user to withdraw the balance in the leaf of the balances tree.
     *        User has to do the following: Prove that a transfer of X tokens was made to the burn address or leaf 0
     * @param _batch_id Deposit tree depth or depth of subtree that is being deposited
     * @param _tx_index Merkle proof proving the node at which we are inserting the deposit subtree consists of all empty leaves
     * @param _txs Deposit tree depth or depth of subtree that is being deposited
     * @param _from_proofs Deposit tree depth or depth of subtree that is being deposited
     * @param _to_proofs Deposit tree depth or depth of subtree that is being deposited
     */
    // function Withdraw(
    //     uint256 _batch_id,
    //     uint256 _tx_index,
    //     dataTypes.Transaction[] memory _txs,
    //     dataTypes.MerkleProof memory _from_proof,
    //     dataTypes.MerkleProof memory _to_proof
    // ) external {
    //     // make sure the batch id is valid
    //     require(
    //         batches.length - 1 >= _batch_id,
    //         "Batch id greater than total number of batches, invalid batch id"
    //     );

    //     dataTypes.Batch memory batch = batches[_batch_id];

    //     // check if the batch is finalised
    //     require(block.number > batch.finalisesOn, "Batch not finalised yet");

    //     // check validity of transactions submitted
    //     bytes[] memory txs;
    //     for (uint256 i = 0; i < _txs.length; i++) {
    //         txs[i] = getTxBytes(_txs[i]);
    //     }
    //     bytes32 txRoot = merkleTreeLib.getMerkleRoot(txs);

    //     // if tx root while submission doesnt match tx root of given txs
    //     // invalid data submitted
    //     require(
    //         txRoot != batch.txRoot,
    //         "Invalid dispute, tx root doesn't match"
    //     );

    //     //NOTE: withdraw transaction is _txs[_tx_index];

    //     // TODO do we need to check if from and to leaf exist in the balance tree here?

    //     // ensure the `to` leaf was the 0th leaf
    //     // require(_txs[_tx_index].to)

    // }

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
     * @notice Requests addition of a new token to the chain, can be called by anyone
     * @param _tokenContractAddress Address for the new token being added
     */
    function requestTokenRegistration(address _tokenContractAddress) public {
        // TODO make sure the token that is being added is an ERC20 token and satisfies IERC20
        tokenRegistry.requestTokenRegistration(_tokenContractAddress);
        logger.logRegistrationRequest(_tokenContractAddress);
    }

    /**
     * @notice Add new tokens to the rollup chain by assigning them an ID called tokenType from here on
     * @param _tokenContractAddress Deposit tree depth or depth of subtree that is being deposited
     */
    function finaliseTokenRegistration(address _tokenContractAddress)
        public
        onlyCoordinator
    {
        tokenRegistry.finaliseTokenRegistration(_tokenContractAddress);
        logger.logRegisteredToken(
            tokenRegistry.numTokens(),
            _tokenContractAddress
        );
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

    //
    // Utils
    //

    // ---------- Account Related Utils -------------------

    // returns a new User Account with updated balance
    function UpdateBalanceInAccount(
        dataTypes.UserAccount memory original_account,
        uint256 new_balance
    ) public returns (dataTypes.UserAccount memory new_account) {
        dataTypes.UserAccount memory newAccount;
        newAccount.balance = new_balance;
        return newAccount;
    }

    function BalanceFromAccount(dataTypes.UserAccount memory account)
        public
        view
        returns (uint256)
    {
        return account.balance;
    }

    function HashFromAccount(dataTypes.UserAccount memory account)
        public
        view
        returns (bytes32)
    {
        return keccak256(BytesFromAccount(account));
    }

    function BytesFromAccount(dataTypes.UserAccount memory account)
        public
        view
        returns (bytes memory)
    {
        return abi.encode(account.balance, account.nonce, account.tokenType);
    }

    // ---------- Tx Related Utils -------------------

    function BytesFromTx(dataTypes.Transaction memory _tx)
        public
        view
        returns (bytes memory)
    {
        return abi.encode(_tx);
    }

    function HashFromTx(dataTypes.Transaction memory _tx)
        public
        view
        returns (bytes32)
    {
        return keccak256(BytesFromTx(_tx));
    }

    function getBalanceTreeRoot() public view returns (bytes32) {
        return balancesTree.getRoot();
    }

    /**
     * @notice Concatenates 2 deposits
     * @return Returns the final hash
     */
    function getDepositsHash(bytes32 a, bytes32 b) public returns (bytes32) {
        return keccak256(abi.encode(a, b));
    }

    /**
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function numberOfBatches() public view returns (uint256) {
        return batches.length;
    }

    /**
     * @notice Removes a deposit from the pendingDeposits queue and shifts the queue
     * @param _index Index of the element to remove
     * @return Remaining elements of the array
     */
    function removeDeposit(uint256 _index) internal returns (bytes32[] memory) {
        require(
            _index < pendingDeposits.length,
            "array index is out of bounds"
        );

        for (uint256 i = _index; i < pendingDeposits.length - 1; i++) {
            pendingDeposits[i] = pendingDeposits[i + 1];
        }
        delete pendingDeposits[pendingDeposits.length - 1];
        pendingDeposits.length--;
        return pendingDeposits;
    }

    /**
     * @notice Calculates the address from the pubkey
     * @param pub is the pubkey
     * @return Returns the address that has been calculated from the pubkey
     */
    function calculateAddress(bytes memory pub)
        public
        pure
        returns (address addr)
    {
        bytes32 hash = keccak256(pub);
        assembly {
            mstore(0, hash)
            addr := mload(0)
        }
    }
}
