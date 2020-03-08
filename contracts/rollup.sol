pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree as MerkleTreeUtil} from "./MerkleTree.sol";
import {DataTypes as dataTypes} from "./DataTypes.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import { ECVerify } from "./ECVerify.sol";

// token registry contract interface
contract ITokenRegistry {
    address public owner;
    uint256 public numTokens;
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) public registeredTokens;
    
    modifier onlyOwner(){
        assert(msg.sender == owner);
        _;
    }
    function requestTokenRegistration(address tokenContract) public {}
    function finaliseTokenRegistration(address tokenContract) public onlyOwner{}
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

    uint DEFAULT_TOKEN_TYPE =0;
    uint256 DEFAULT_DEPTH = 2;
    uint MAX_DEPTH = 5;
 
    bytes32 public ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    // hashes for empty tree of depth MAX DEPTH
    bytes32[] public zeroCache = new bytes32[](5);
    //[
    //     0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563, //H0 = empty leaf
    //     0x633dc4d7da7256660a892f8f1604a44b5432649cc8ec5cb3ced4c4e6ac94dd1d,  //H1 = hash(H0, H0)
    //     0x890740a8eb06ce9be422cb8da5cdafc2b58c0a5e24036c578de2a433c828ff7d,  //H2 = hash(H1, H1)
    //     0x3b8ec09e026fdc305365dfc94e189a81b38c7597b3d941c279f042e8206e0bd8, //...and so on
    //     0xecd50eee38e386bd62be9bedb990706951b65fe053bd9d8a521af753d139e2da
    //];


    /*********************
     * Variable Declarations *
     ********************/

    // external contracts
    MerkleTreeUtil merkleTreeUtil;
    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;

    address operator;

    mapping(uint256 => address) IdToAccounts;
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

    event RegisteredToken(uint tokenType, address tokenContract);
    event RegistrationRequest(address tokenContract);

    event DepositQueued(address,uint,uint,bytes32);
    event DepositLeafMerged();
    event DepositsProcessed();

    modifier onlyOperator(){
        assert(msg.sender == operator);
        _;
    }


    /*********************
     * Constructor *
     ********************/

    constructor(address _merkleTreeLib,address _tokenRegistryAddr,bytes32[] memory _zeroCache) public{
        merkleTreeUtil = MerkleTreeUtil(_merkleTreeLib);
        tokenRegistry = ITokenRegistry(_tokenRegistryAddr);
        operator = msg.sender;

        zeroCache = _zeroCache;
        // initialise merkle tree
        initMT();
    }

    /**
     * @notice Initilises merkle tree variables
     */
    function initMT() public{
        merkleTreeUtil.setMerkleRootAndHeight(ZERO_BYTES32,DEFAULT_DEPTH);
    }

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(bytes[] calldata _txs,bytes32 _updatedRoot) external {
     bytes32 txRoot = merkleTreeUtil.getMerkleRoot(_txs);

     // make merkel root of all txs
     dataTypes.Batch memory newBatch = dataTypes.Batch({
        stateRoot: _updatedRoot,
        committer: msg.sender,
        txRoot: txRoot,
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
        dataTypes.MerkleProof[] memory _to_proofs) public returns(bool) {
            bytes[] memory txs;
            for (uint i = 0; i < _txs.length; i++) {
                txs[i] = getTxBytes(_txs[i]);
            }
            bytes32 txRoot = merkleTreeUtil.getMerkleRoot(txs);

            // if tx root while submission doesnt match tx root of given txs
            // dispute is successful
            require(txRoot!=batches[_batch_id].txRoot,"Dispute incorrect, tx root doesn't match");
            bytes32 newBalanceRoot;
            uint256 fromBalance;
            uint256 toBalance;
            for (uint i = 0; i < _txs.length; i++) {
                // call process tx update for every transaction to check if any
                // tx evaluates correctly
                (newBalanceRoot,fromBalance,toBalance) = processTxUpdate(batches[_batch_id].stateRoot,_txs[i],_from_proofs[i],_to_proofs[i]);
            }
            
            require(newBalanceRoot==batches[_batch_id].stateRoot,"Balance root doesnt match");
            // TODO slash when balance root doesnt match
    }

    /**
    *  @notice processTxUpdate processes a transactions and returns the updated balance tree
    *  and the updated leaves
    * @return Total number of batches submitted onchain
    */
    function processTxUpdate(bytes32 _balanceRoot, dataTypes.Transaction memory _tx,
        dataTypes.MerkleProof memory _from_merkle_proof,dataTypes.MerkleProof memory _to_merkle_proof
    ) public returns(bytes32,uint256,uint256){
        
        // verify from leaf exists in the balance tree
        require(merkleTreeUtil.verify(
                _balanceRoot,
                getAccountBytesFromLeaf(_from_merkle_proof.account),
                _from_merkle_proof.account.path,
                _from_merkle_proof.siblings)
            ,"Merkle Proof for from leaf is incorrect");
    
        // verify to leaf exists in the balance tree
        require(merkleTreeUtil.verify(
                _balanceRoot,
                getAccountBytesFromLeaf(_to_merkle_proof.account),
                _to_merkle_proof.account.path,
                _to_merkle_proof.siblings),
            "Merkle Proof for from leaf is incorrect");

        // check from leaf has enough balance
        require(_from_merkle_proof.account.balance>_tx.amount,"Sender doesnt have enough balance");

        // check signature on the tx is correct
        // TODO fix
        // require(IdToAccounts[_tx.from.path] == getTxBytesHash(_tx).ecrecovery(_tx.signature),"Signature is incorrect");

        // check token type is correct
        require(_tx.tokenType==DEFAULT_TOKEN_TYPE,"Invalid token type");
        
        // reduce balance of from leaf
        dataTypes.AccountLeaf memory new_from_leaf = updateBalanceInLeaf(_from_merkle_proof.account,
            getBalanceFromAccountLeaf(_from_merkle_proof.account).sub(_tx.amount));

        bytes32 newRoot = merkleTreeUtil.updateLeafWithSiblings(keccak256(getAccountBytesFromLeaf(new_from_leaf)),
                _from_merkle_proof.account.path,
                _balanceRoot,
                _from_merkle_proof.siblings);

        // increase balance of to leaf
        dataTypes.AccountLeaf memory new_to_leaf = updateBalanceInLeaf(_to_merkle_proof.account,
            getBalanceFromAccountLeaf(_to_merkle_proof.account).add(_tx.amount));

        // update the merkle tree
        merkleTreeUtil.update(getAccountBytesFromLeaf(new_to_leaf), _to_merkle_proof.account.path);
        newRoot = merkleTreeUtil.updateLeafWithSiblings(keccak256(getAccountBytesFromLeaf(new_to_leaf)),
                _to_merkle_proof.account.path,
                newRoot,
                _to_merkle_proof.siblings);

        return (newRoot, getBalanceFromAccountLeaf(new_from_leaf), getBalanceFromAccountLeaf(new_to_leaf));
    }
    
    /**
    * @notice Adds a deposit for the msg.sender to the deposit queue
    * @param _amount Number of tokens that user wants to deposit
    * @param _tokenType Type of token user is depositing
    */
    function deposit(uint _amount,uint _tokenType)public{
        depositFor(msg.sender,_amount,_tokenType);
    }

    /**
    * @notice Adds a deposit for an address to the deposit queue
    * @param _destination Address for which we are depositing
    * @param _amount Number of tokens that user wants to deposit
    * @param _tokenType Type of token user is depositing
    */
    function depositFor(address _destination,uint _amount,uint _tokenType) public {
        // check amount is greater than 0
        require(_amount > 0,"token deposit must be greater than 0");

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
    * @notice Merges the deposit tree with the balance tree by superimposing the deposit subtree on the balance tree
    * @param _subTreeDepth Deposit tree depth or depth of subtree that is being deposited
    * @param _zero_account_mp Merkle proof proving the node at which we are inserting the deposit subtree consists of all empty leaves
    * @return Updates in-state merkle tree root
    */
    function finaliseDeposits(uint _subTreeDepth,dataTypes.MerkleProof memory _zero_account_mp) public onlyOperator returns(bytes32) {
        bytes32 emptySubtreeRoot = zeroCache[_subTreeDepth];
        
        // from mt proof we find the root of the tree
        // we match the root to the balance tree root on-chain
        require(merkleTreeUtil.verifyLeaf(
            merkleTreeUtil.getRoot(),
            emptySubtreeRoot,
            _zero_account_mp.account.path,
            _zero_account_mp.siblings),"proof invalid");

        // update the in-state balance tree with new leaf from pendingDeposits[0]
        merkleTreeUtil.updateLeaf(pendingDeposits[0],_zero_account_mp.account.path);
    
        // removed the root at pendingDeposits[0] because it has been added to the balance tree
        removeDeposit(0);

        // update the number of elements present in the queue
        queueNumber = queueNumber - 2**depositSubtreeHeight;

        // return the updated merkle tree root
        return merkleTreeUtil.getRoot();
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
    ) public onlyOperator {
        tokenRegistry.finaliseTokenRegistration(_tokenContractAddress);
        emit RegisteredToken(tokenRegistry.numTokens(),_tokenContractAddress);
    }


    //
    // Utils
    //
    
    // returns a new leaf with updated balance
    function updateBalanceInLeaf(dataTypes.AccountLeaf memory original_account, uint256 new_balance) public returns(dataTypes.AccountLeaf memory new_account){
        dataTypes.AccountLeaf memory newAccount;
        return newAccount;
    }

    // getBalanceFromAccount extracts the balance from the leaf
    function getBalanceFromAccount(dataTypes.Account memory account) public view returns(uint256) {
        // TODO add abi.decode
        return 0;
    }

    function getBalanceFromAccountLeaf(dataTypes.AccountLeaf memory account) public view returns(uint256) {
        return 0;
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
    
    function getTxBytes(dataTypes.Transaction memory tx) public view returns(bytes memory){
        // return abi.encode(tx.from, tx.to,tx.tokenType,tx.amount,tx.signature);
        return abi.encode(tx);
    }

    function getTxBytesHash(dataTypes.Transaction memory tx) public view returns(bytes32){
        return keccak256(getTxBytes(tx));
    }


    function getBalanceTreeRoot() public view returns(bytes32) {
        return merkleTreeUtil.getRoot();
    }

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
    
}
