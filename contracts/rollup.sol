pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree as MerkleTreeUtil} from "./MerkleTree.sol";
import {DataTypes as dataTypes} from "./DataTypes.sol";

contract Rollup {
    uint DEFAULT_TOKEN_TYPE =0;
    uint256 DEFAULT_DEPTH = 2;
    bytes32 public ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;
    
    /*********************
     * Variable Declarations *
     ********************/
    mapping(uint256=>dataTypes.Account) accounts;
    dataTypes.Batch[] public batches;
    MerkleTreeUtil merkleTreeUtil;

    /*********************
     * Events *
     ********************/
    event NewBatch(bytes32 txroot, bytes32 updatedRoot);
    event NewAccount(bytes32 root, uint256 index);
    event SiblingsGenerated(bytes32[] to_siblings, uint to_path, bytes32[] from_siblings, uint from_path);

    /*********************
     * Constructor *
     ********************/
    constructor(address merkleTreeLib) public{
        merkleTreeUtil = MerkleTreeUtil(merkleTreeLib);
        initAccounts();
    }

    /**
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function numberOfBatches() public view returns (uint256){
        return batches.length;
    }

    /**
     * @notice Initilises genesis accounts 
     */
    function initAccounts() public{
        dataTypes.Account memory genAccount;
        genAccount.path = 100;
        genAccount.balance=100;
        genAccount.tokenType=DEFAULT_TOKEN_TYPE;
        genAccount.nonce=0;
        bytes[] memory acc = new bytes[](1);
        acc[0] = getAccountBytes(genAccount);
        bytes32 root = merkleTreeUtil.getMerkleRoot(acc);
        merkleTreeUtil.setMerkleRootAndHeight(root,DEFAULT_DEPTH);
    }

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(bytes[] calldata _txs,bytes32 _updatedRoot) external  {
     bytes32 txRoot = merkleTreeUtil.getMerkleRoot(_txs);
     // make merkel root of all txs
     dataTypes.Batch memory newBatch = dataTypes.Batch({
        stateRoot: _updatedRoot,
        committer: msg.sender,
        txRoot: txRoot,
        timestamp: now
     });

     batches.push(newBatch);
     emit NewBatch(txRoot,_updatedRoot);
    }

    function processTxUpdate(bytes32 _balanceRoot, dataTypes.Transaction memory _tx,
        dataTypes.MerkleProof memory _from_merkle_proof,dataTypes.MerkleProof memory _to_merkle_proof
    ) public returns(bytes32,uint256,uint256){
        //
        // Verify accounts exist in the provided merkle tree
        //

        // verify from leaf exists in the balance tree
        require(merkleTreeUtil.verify(_balanceRoot,getAccountBytes(_from_merkle_proof.account),_from_merkle_proof.account.path,_from_merkle_proof.siblings),"Merkle Proof for from leaf is incorrect");            
        // verify to leaf exists in the balance tree
        require(merkleTreeUtil.verify(_balanceRoot,getAccountBytes(_to_merkle_proof.account),_to_merkle_proof.account.path,_to_merkle_proof.siblings),"Merkle Proof for from leaf is incorrect");

        //
        //  TODO add all checks
        //
        
        // reduce balance of from leaf
        // TODO use safe math
        dataTypes.Account memory new_from_leaf = updateBalanceInLeaf(_from_merkle_proof.account,getBalanceFromAccount(_from_merkle_proof.account)-_tx.amount);
        merkleTreeUtil.update(getAccountBytes(new_from_leaf), _from_merkle_proof.account.path);

        // increase balance of to leaf
        // TODO use safe math
        dataTypes.Account memory new_to_leaf = updateBalanceInLeaf(_to_merkle_proof.account,getBalanceFromAccount(_to_merkle_proof.account)+_tx.amount);
        merkleTreeUtil.update(getAccountBytes(new_to_leaf), _to_merkle_proof.account.path);

        return (getBalanceTreeRoot(), getBalanceFromAccount(new_from_leaf), getBalanceFromAccount(new_to_leaf));
    }


    //
    // Utils 
    //
    
    // returns a new leaf with updated balance
    function updateBalanceInLeaf(dataTypes.Account memory original_account, uint256 new_balance) public returns(dataTypes.Account memory new_account){
        dataTypes.Account memory newAccount;
        return newAccount;
    }

    // getBalanceFromAccount extracts the balance from the leaf
    function getBalanceFromAccount(dataTypes.Account memory account) public view returns(uint256) {
        return 0;
    }

    function getAccountBytes(dataTypes.Account memory account) public view returns(bytes memory){
        return abi.encode(account.balance, account.nonce,account.path,account.tokenType);
    }    

    function getBalanceTreeRoot() public view returns(bytes32) {
        return merkleTreeUtil.getRoot();
    }
}