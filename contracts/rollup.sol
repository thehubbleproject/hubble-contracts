pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree as MerkleTreeUtil} from "./MerkleTree.sol";
import {DataTypes as dataTypes} from "./DataTypes.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import { ECVerify } from "./ECVerify.sol";

contract Rollup {
    using SafeMath for uint256;
    using BytesLib for bytes;
    using ECVerify for bytes32;

    uint DEFAULT_TOKEN_TYPE =0;
    uint256 DEFAULT_DEPTH = 2;
    bytes32 public ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;
    
    /*********************
     * Variable Declarations *
     ********************/
    mapping(uint256 => address) IdToAccounts;
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

        // TODO remove after adding deposit
        initAccounts();
    }

    /**
     * @notice Initilises genesis accounts 
     */
    function initAccounts() public{
        dataTypes.Account memory genAccount1;
        genAccount.path = 00;
        genAccount.balance=100;
        genAccount.tokenType=DEFAULT_TOKEN_TYPE;
        genAccount.nonce=0;
        dataTypes.Account memory genAccount2;
        genAccount2.path = 11;
        genAccount2.balance=100;
        genAccount2.tokenType=DEFAULT_TOKEN_TYPE;
        genAccount2.nonce=0;
        bytes[] memory acc = new bytes[](2);
        acc[0] = getAccountBytes(genAccount);
        acc[2] = getAccountBytes(genAccount2);
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


    /**
    *  disputeBatch processes a transactions and returns the updated balance tree
    *  and the updated leaves.
    * @notice Gives the number of batches submitted on-chain
    * @return Total number of batches submitted onchain
    */
    function disputeBatch(uint256 batch_id,
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
            require(txRoot!=batches[batch_id].txRoot,"Dispute incorrect, tx root doesn't match");
            bytes32 newBalanceRoot;
            uint256 fromBalance;
            uint256 toBalance;
            for (uint i = 0; i < _txs.length; i++) {
                // call process tx update for every transaction to check if any
                // tx evaluates correctly
                (newBalanceRoot,fromBalance,toBalance) = processTxUpdate(batches[batch_id].stateRoot,_txs[i],_from_proofs[i],_to_proofs[i]);
            }
            
            require(newBalanceRoot==batches[batch_id].stateRoot,"Balance root doesnt match");
            // TODO slash when balance root doesnt match
    }

    /**
    *  processTxUpdate processes a transactions and returns the updated balance tree
    *  and the updated leaves
    * @notice Gives the number of batches submitted on-chain
    * @return Total number of batches submitted onchain
    */
    function processTxUpdate(bytes32 _balanceRoot, dataTypes.Transaction memory _tx,
        dataTypes.MerkleProof memory _from_merkle_proof,dataTypes.MerkleProof memory _to_merkle_proof
    ) public returns(bytes32,uint256,uint256){
        
        // verify from leaf exists in the balance tree
        require(merkleTreeUtil.verify(
                _balanceRoot,getAccountBytes(_from_merkle_proof.account),
                _from_merkle_proof.account.path,
                _from_merkle_proof.siblings)
            ,"Merkle Proof for from leaf is incorrect");
    
        // verify to leaf exists in the balance tree
        require(merkleTreeUtil.verify(
                _balanceRoot,getAccountBytes(_to_merkle_proof.account),
                _to_merkle_proof.account.path,
                _to_merkle_proof.siblings),
            "Merkle Proof for from leaf is incorrect");

        // check from leaf has enough balance
        require(_from_merkle_proof.account.balance>_tx.amount,"Sender doesnt have enough balance");

        // check signature on the tx is correct
        require(IdToAccounts[_tx.from.path] == getTxBytesHash(_tx).ecrecovery(_tx.signature),"Signature is incorrect");

        // check token type is correct
        require(_tx.tokenType==DEFAULT_TOKEN_TYPE,"Invalid token type");
        
        // reduce balance of from leaf
        dataTypes.Account memory new_from_leaf = updateBalanceInLeaf(_from_merkle_proof.account,
            getBalanceFromAccount(_from_merkle_proof.account).sub(_tx.amount));

        bytes32 newRoot = merkleTreeUtil.updateLeafWithSiblings(keccak256(getAccountBytes(new_from_leaf)),
                _from_merkle_proof.account.path,
                _balanceRoot,
                _from_merkle_proof.siblings);

        // increase balance of to leaf
        dataTypes.Account memory new_to_leaf = updateBalanceInLeaf(_to_merkle_proof.account,
            getBalanceFromAccount(_to_merkle_proof.account).add(_tx.amount));

        // update the merkle tree
        merkleTreeUtil.update(getAccountBytes(new_to_leaf), _to_merkle_proof.account.path);
        newRoot = merkleTreeUtil.updateLeafWithSiblings(keccak256(getAccountBytes(new_to_leaf)),
                _to_merkle_proof.account.path,
                newRoot,
                _to_merkle_proof.siblings);

        return (newRoot, getBalanceFromAccount(new_from_leaf), getBalanceFromAccount(new_to_leaf));
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

    /**
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function numberOfBatches() public view returns (uint256){
        return batches.length;
    }
}
