pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree} from "./MerkleTree.sol";
import {MerkleTreeLib} from "./libs/MerkleTreeLib.sol";

import {DataTypes as dataTypes} from "./DataTypes.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import { ECVerify } from "./ECVerify.sol";

// token registry contract interface
contract ITokenRegistry {
    address public Coordinator;
    uint256 public numTokens;
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) public registeredTokens;
    
    modifier onlyCoordinator(){
        assert(msg.sender == Coordinator);
        _;
    }
    function requestTokenRegistration(address tokenContract) public {}
    function finaliseTokenRegistration(address tokenContract) public {}
}


// ERC20 token interface
contract IERC20 {
    function transferFrom(address from, address to, uint256 value) public returns(bool) {}
	function transfer(address recipient, uint value) public returns (bool) {}
}

// Main rollup contract
contract Rollup {
    using SafeMath for uint256;
    using BytesLib for bytes;
    using ECVerify for bytes32;

    uint MAX_DEPTH;
    uint STAKE_AMOUNT = 32;
    address payable BURN_ADDRESS = 0x0000000000000000000000000000000000000000;
    
    address coordinator;

    // finalisation time is the number of blocks required by a batch to finalise
    // Delay period = 7 days. Block time = 15 seconds
    uint finalisationTime = 40320;

    /*********************
     * Variable Declarations *
     ********************/

    // External contracts
    MerkleTreeLib public merkleTreeLib;
    MerkleTree public balancesTree;
    MerkleTree public accountsTree;
    
    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;

    mapping(uint256=>dataTypes.Account) accounts;
    dataTypes.Batch[] public batches;
    
    bytes32[] public pendingDeposits;
    uint public queueNumber;
    uint public depositSubtreeHeight;

    /*********************
     * Events *
     ********************/
    event NewBatch(address committer,bytes32 txroot, bytes32 updatedRoot);
    event NewAccount(bytes32 root, uint256 index);

    event DepositQueued(address,uint,uint,bytes32);
    event DepositLeafMerged();
    event DepositsProcessed();

    event StakeWithdraw(address committed,uint amount,uint batch_id);
    event BatchRollback(uint batch_id,address committer,bytes32 stateRoot,bytes32 txRoot,uint stakeSlashed);

    event RollbackFinalisation(uint totalBatchesSlashed);

    event RegisteredToken(uint tokenType, address tokenContract);
    event RegistrationRequest(address tokenContract);

    modifier onlyCoordinator(){
        assert(msg.sender == coordinator);
        _;
    }

    /*********************
     * Constructor *
     ********************/
    constructor(address _balancesTree,address _accountsTree, address _merkleTreeLib, address _tokenRegistryAddr,address _coordinator) public{
        merkleTreeLib = MerkleTreeLib(_merkleTreeLib);
        balancesTree = MerkleTree(_balancesTree);
        accountsTree = MerkleTree(_accountsTree);
        tokenRegistry = ITokenRegistry(_tokenRegistryAddr);
        coordinator = _coordinator;
    }

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(bytes[] calldata _txs,bytes32 _updatedRoot) external onlyCoordinator  payable {
    require(msg.value==STAKE_AMOUNT,"Please send 32 eth with batch as stake");
     bytes32 txRoot = merkleTreeLib.getMerkleRoot(_txs);

     // make merkel root of all txs
     dataTypes.Batch memory newBatch = dataTypes.Batch({
        stateRoot: _updatedRoot,
        committer: msg.sender,
        txRoot: txRoot,
        stakeCommitted: msg.value,
        finalisesOn: block.number + finalisationTime,
        timestamp: now
     });

     batches.push(newBatch);
     emit NewBatch(newBatch.committer,txRoot,_updatedRoot);
    }


    /** 
    *  disputeBatch processes a transactions and returns the updated balance tree
    *  and the updated leaves.
    * @notice Gives the number of batches submitted on-chain
    * @return Total number of batches submitted onchain
    */
    function disputeBatch(uint256 _batch_id,
        dataTypes.Transaction[] memory _txs,
        dataTypes.MerkleProof[] memory _from_proofs,
        dataTypes.MerkleProof[] memory _to_proofs) public {
            // load batch
            dataTypes.Batch memory disputed_batch = batches[_batch_id];
            require(disputed_batch.stakeCommitted!=0, "Batch doesnt exist or is slashed already");

            // check if batch is disputable
            require(block.number < disputed_batch.finalisesOn,"Batch already finalised");

            // generate merkle tree from the txs provided by user
            bytes[] memory txs;
            for (uint i = 0; i < _txs.length; i++) {
                txs[i] = getTxBytes(_txs[i]);
            }
            bytes32 txRoot = merkleTreeLib.getMerkleRoot(txs);

            // if tx root while submission doesnt match tx root of given txs
            // dispute is unsuccessful
            require(txRoot!=disputed_batch.txRoot,"Invalid dispute, tx root doesn't match");

            // run every transaction through transaction evaluators
            bytes32 newBalanceRoot;
            uint256 fromBalance;
            uint256 toBalance;
            for (uint i = 0; i < _txs.length; i++) {
                // call process tx update for every transaction to check if any
                // tx evaluates correctly
                (newBalanceRoot,fromBalance,toBalance) = processTxUpdate(batches[_batch_id].stateRoot,_txs[i],_from_proofs[i],_to_proofs[i]);
            }
            
            // if new root doesnt match what was submitted by coordinator
            // slash and rollback
            if (newBalanceRoot!=disputed_batch.stateRoot) {
                SlashAndRollback(_batch_id);
            }
    }
    
    /**
    * @notice processTxUpdate processes a transactions and returns the updated balance tree
    *  and the updated leaves
    * @return Total number of batches submitted onchain
    */
    function processTxUpdate(bytes32 _balanceRoot, dataTypes.Transaction memory _tx,
        dataTypes.MerkleProof memory _from_merkle_proof,dataTypes.MerkleProof memory _to_merkle_proof
    ) public returns(bytes32,uint256,uint256){
        // check from leaf has enough balance
        require(_from_merkle_proof.account.balance>_tx.amount,"Sender doesnt have enough balance");

        // check signature on the tx is correct
        // TODO fix
        // require(IdToAccounts[_tx.from.path] == getTxBytesHash(_tx).ecrecovery(_tx.signature),"Signature is incorrect");

        // check token type is registered
        require(tokenRegistry.registeredTokens(_tx.tokenType)!=address(0),"Token not registered");
            
        // verify from leaf exists in the balance tree
        require(merkleTreeLib.verify(
                _balanceRoot,
                getAccountBytesFromLeaf(_from_merkle_proof.account),
                _from_merkle_proof.account.path,
                _from_merkle_proof.siblings)
            ,"Merkle Proof for from leaf is incorrect");

        // account holds the token type in the tx
        require(_from_merkle_proof.account.tokenType==_tx.tokenType,"From leaf doesn't hold the token mentioned");

        // reduce balance of from leaf
        dataTypes.AccountLeaf memory new_from_leaf = updateBalanceInLeaf(_from_merkle_proof.account,
            getBalanceFromAccountLeaf(_from_merkle_proof.account).sub(_tx.amount));

        bytes32 newRoot = merkleTreeLib.updateLeafWithSiblings(keccak256(getAccountBytesFromLeaf(new_from_leaf)),
                _from_merkle_proof.account.path,
                _balanceRoot,
                _from_merkle_proof.siblings);

        // verify to leaf exists in the balance tree
        require(merkleTreeLib.verify(
                newRoot,
                getAccountBytesFromLeaf(_to_merkle_proof.account),
                _to_merkle_proof.account.path,
                _to_merkle_proof.siblings),
            "Merkle Proof for from leaf is incorrect");

        // account holds the token type in the tx
        require(_to_merkle_proof.account.tokenType==_tx.tokenType,"To leaf doesn't hold the token mentioned");

        // increase balance of to leaf
        dataTypes.AccountLeaf memory new_to_leaf = updateBalanceInLeaf(_to_merkle_proof.account,
            getBalanceFromAccountLeaf(_to_merkle_proof.account).add(_tx.amount));

        // update the merkle tree
        balancesTree.update(getAccountBytesFromLeaf(new_to_leaf), _to_merkle_proof.account.path);
        newRoot = merkleTreeLib.updateLeafWithSiblings(keccak256(getAccountBytesFromLeaf(new_to_leaf)),
                _to_merkle_proof.account.path,
                newRoot,
                _to_merkle_proof.siblings);

        return (newRoot, getBalanceFromAccountLeaf(new_from_leaf), getBalanceFromAccountLeaf(new_to_leaf));
    }


    /**
    * @notice SlashAndRollback slashes all the coordinator's who have built on top of the invalid batch
    * and rewards challegers. Also deletes all the batches after invalid batch
    * @param _invalid_batch_id ID of the batch that has been challenged
    */
    function SlashAndRollback(uint _invalid_batch_id)internal{
        uint challengerRewards = 0;
        uint burnedAmount = 0;
        uint totalSlashings = 0;
        for(uint i = batches.length-1;i>=_invalid_batch_id; i--){
            // load batch
            dataTypes.Batch memory batch = batches[i];

            // TODO use safe math
            // calculate challeger's reward
            challengerRewards += batch.stakeCommitted * 2 / 3;
            burnedAmount += batch.stakeCommitted.sub(challengerRewards);
            
            batches[i].stakeCommitted = 0;

            // delete batch
            delete batches[i];

            totalSlashings++;
            emit BatchRollback(i,batch.committer,batch.stateRoot,batch.txRoot,batch.stakeCommitted);
        }

        // TODO add deposit rollback

        // transfer reward to challenger
        (msg.sender).transfer(challengerRewards);

        // burn the remaning amount
        (BURN_ADDRESS).transfer(burnedAmount);

        // resize batches length
        batches.length = batches.length.sub(_invalid_batch_id.sub(1));
        
        emit RollbackFinalisation(totalSlashings);
    }
    
    /**
    * @notice Adds a deposit for the msg.sender to the deposit queue
    * @param _amount Number of tokens that user wants to deposit
    * @param _tokenType Type of token user is depositing
    */
    function deposit(uint _amount,uint _tokenType, bytes memory _pubkey)public{
        depositFor(msg.sender,_amount,_tokenType,_pubkey);
    }

    /**
    * @notice Adds a deposit for an address to the deposit queue
    * @param _destination Address for which we are depositing
    * @param _amount Number of tokens that user wants to deposit
    * @param _tokenType Type of token user is depositing
    */
    function depositFor(address _destination,uint _amount,uint _tokenType, bytes memory _pubkey) public {
        // check amount is greater than 0
        require(_amount > 0,"token deposit must be greater than 0");
        
        // ensure public matches the destination address
       require(_destination == calculateAddress(_pubkey),"public key and address don't match");

        // check token type exists
        address tokenContractAddress = tokenRegistry.registeredTokens(_tokenType);
        tokenContract = IERC20(tokenContractAddress);

        // transfer from msg.sender to this contract
        require(
            tokenContract.transferFrom(msg.sender, address(this), _amount),
            "token transfer not approved"
        );

        // create a new account
        dataTypes.Account memory newAccount;
        newAccount.balance = _amount;
        newAccount.tokenType = _tokenType;
        newAccount.nonce = 0;
        
        //TODO add pubkey to the accounts tree

        // get new account hash
        bytes32 accountHash = getAccountHash(newAccount);

        // queue the deposit
        pendingDeposits.push(accountHash);
    
        // emit the event
        emit DepositQueued(_destination, _amount, _tokenType,accountHash);

        queueNumber++;
        uint tmpDepositSubtreeHeight = 0;
        uint tmp = queueNumber;
        while(tmp % 2 == 0){
            bytes32[] memory deposits = new bytes32[](2);
            deposits[0] = pendingDeposits[pendingDeposits.length - 2];
            deposits[1] = pendingDeposits[pendingDeposits.length - 1];

            pendingDeposits[pendingDeposits.length - 2] = getDepositsHash(deposits[0],deposits[1]);
            removeDeposit(pendingDeposits.length - 1);
            tmp = tmp / 2;
            tmpDepositSubtreeHeight++;
        }
        if (tmpDepositSubtreeHeight > depositSubtreeHeight){
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }
    }

    /**
    * @notice Merges the deposit tree with the balance tree by
    *        superimposing the deposit subtree on the balance tree
    * @param _subTreeDepth Deposit tree depth or depth of subtree that is being deposited
    * @param _zero_account_mp Merkle proof proving the node at which we are inserting the deposit subtree consists of all empty leaves
    * @return Updates in-state merkle tree root
    */
    function finaliseDeposits(uint _subTreeDepth,dataTypes.MerkleProof memory _zero_account_mp) public onlyCoordinator returns(bytes32) {
        bytes32 emptySubtreeRoot = merkleTreeLib.getRoot(_subTreeDepth);
        
        // from mt proof we find the root of the tree
        // we match the root to the balance tree root on-chain
        require(merkleTreeLib.verifyLeaf(
            getBalanceTreeRoot(),
            emptySubtreeRoot,
            _zero_account_mp.account.path,
            _zero_account_mp.siblings),"proof invalid");

        // update the in-state balance tree with new leaf from pendingDeposits[0]
        balancesTree.updateLeaf(pendingDeposits[0],_zero_account_mp.account.path);
    
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
    function requestTokenRegistration(
        address _tokenContractAddress
    ) public {
        // TODO make sure the token that is being added is an ERC20 token and satisfies IERC20
        tokenRegistry.requestTokenRegistration(_tokenContractAddress);
        emit RegistrationRequest(_tokenContractAddress);
    }

    /**
    * @notice Add new tokens to the rollup chain by assigning them an ID called tokenType from here on
    * @param _tokenContractAddress Deposit tree depth or depth of subtree that is being deposited
    */
    function finaliseTokenRegistration(
        address _tokenContractAddress
    ) public onlyCoordinator {
        tokenRegistry.finaliseTokenRegistration(_tokenContractAddress);
        emit RegisteredToken(tokenRegistry.numTokens(),_tokenContractAddress);
    }

    /**
    * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
    * @param batch_id Batch ID that the coordinator submitted
    */
    function WithdrawStake(uint batch_id)public {
        dataTypes.Batch memory committedBatch = batches[batch_id];
        require(msg.sender==committedBatch.committer,"You are not the correct committer for this batch");
        require(block.number>committedBatch.finalisesOn,"This batch is not yet finalised, check back soon!");
        msg.sender.transfer(committedBatch.stakeCommitted);
        emit StakeWithdraw(msg.sender,committedBatch.stakeCommitted,batch_id);
    }

    //
    // Utils
    //
    
    // returns a new leaf with updated balance
    function updateBalanceInLeaf(
            dataTypes.AccountLeaf memory original_account,
            uint256 new_balance
    ) public returns(dataTypes.AccountLeaf memory new_account){
        dataTypes.AccountLeaf memory newAccount;
        newAccount.balance = new_balance;
        return newAccount;
    }

    // getBalanceFromAccount extracts the balance from the leaf
    function getBalanceFromAccount(dataTypes.Account memory account) public view returns(uint256) {
        // TODO add abi.decode
        return 0;
    }

    function getBalanceFromAccountLeaf(dataTypes.AccountLeaf memory account) public view returns(uint256) {
        return account.balance;
    }

    function getAccountHash(dataTypes.Account memory account) public view returns(bytes32){
        return keccak256(getAccountBytes(account));
    }

    function getAccountBytes(dataTypes.Account memory account) public view returns(bytes memory){
        return abi.encode(account.balance, account.nonce,account.tokenType);
    }

    function getAccountBytesFromLeaf(dataTypes.AccountLeaf memory account) public view returns(bytes memory){
        return abi.encode(account.balance, account.nonce,account.tokenType);
    }
    
    function getTxBytes(dataTypes.Transaction memory _tx) public view returns(bytes memory){
        // return abi.encode(tx.from, tx.to,tx.tokenType,tx.amount,tx.signature);
        return abi.encode(_tx);
    }

    function getTxBytesHash(dataTypes.Transaction memory _tx) public view returns(bytes32){
        return keccak256(getTxBytes(_tx));
    }


    function getBalanceTreeRoot() public view returns(bytes32) {
        return balancesTree.getRoot();
    }

    /**
     * @notice Concatenates 2 deposits
     * @return Returns the final hash
     */
    function getDepositsHash(bytes32 a, bytes32 b) public returns(bytes32){
        return keccak256(abi.encode(a,b));
    }

    /**
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function numberOfBatches() public view returns (uint256){
        return batches.length;
    }

    /**
    * @notice Removes a deposit from the pendingDeposits queue and shifts the queue
    * @param _index Index of the element to remove
    * @return Remaining elements of the array
    */
    function removeDeposit(uint _index) internal returns(bytes32[] memory) {
        require(_index < pendingDeposits.length, "array index is out of bounds");

        for (uint i = _index; i<pendingDeposits.length-1; i++){
            pendingDeposits[i] = pendingDeposits[i+1];
        }
        delete pendingDeposits[pendingDeposits.length-1];
        pendingDeposits.length--;
        return pendingDeposits;
    }


    /**
    * @notice Calculates the address from the pubkey
    * @param pub is the pubkey
    * @return Returns the address that has been calculated from the pubkey
    */
    function calculateAddress(bytes memory pub) public pure returns (address addr) {
        bytes32 hash = keccak256(pub);
        assembly {
            mstore(0, hash)
            addr := mload(0)
        }
    }
    
}
