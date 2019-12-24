pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree as MerkleTreeUtil} from "./merkleTreeLib.sol";


contract Rollup {
    /*********************
     * Variable Declarations *
     ********************/

    // Batch
    struct Batch{
        bytes32 stateRoot;
        bytes32 withdraw_root;
        address committer;
        bytes32 account_tree_state;
        bytes32 txRoot;
        uint timestamp;
    }

    mapping(uint256=>bytes) accounts;
    uint256 lastAccountIndex=0;
    Batch[] public batches;
    bytes32 public balanceTreeRoot;
    bytes32 public ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    MerkleTreeUtil merkleTreeUtil;

    /*********************
     * Events *
     ********************/
    event NewBatch(bytes32 txroot, bytes32 updatedRoot);
    event NewAccount(bytes32 root, uint256 index);
    

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

    // /**
    //  * @notice Verify an inclusion proof.
    //  * @param _root The root of the tree we are verifying inclusion for.
    //  * @param _dataBlock The data block we're verifying inclusion for.
    //  * @param _path The path from the leaf to the root.
    //  * @param _siblings The sibling nodes along the way.
    //  * @return The next level of the tree
    //  */
    // function updateTx(bytes memory _tx,uint256 tx_from,uint256 tx_to,uint256 tx_amount,bytes memory proof_from,bytes memory proof_to) public {

    // }

    /**
     * @notice Initilises genesis accounts 
     */
    function initAccounts() public{
        accounts[0] = bytes("0x046af4195060cfb39a6f53a84ea8f52c4339f277acb48281476df5b9773a44394fdc5280263a7ccceaa51ed7d2a76fb1b2e4ff3275b4f027d228989d213efadb93");
        lastAccountIndex++;
        // bytes memory data = abi.encodePacked(uint256(0),uint256(0),uint256(10),uint256(0));
        // bytes32 root = merkleTreeUtil.insert(keccak256(data));
        // balanceTreeRoot = root;
    }

    /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions. 
     */
    function submitBatch(bytes[] calldata _txs,bytes32 _updatedRoot) external  {
     bytes32 txRoot = merkleTreeUtil.getMerkleRoot(_txs);
     // make merkel root of all txs
     Batch memory newBatch = Batch({
        stateRoot: _updatedRoot,
        committer: msg.sender,
        account_tree_state: ZERO_BYTES32,
        withdraw_root: ZERO_BYTES32,
        txRoot: txRoot,
        timestamp: now
     });

     batches.push(newBatch);
     emit NewBatch(txRoot,_updatedRoot);
    }

    // /**
    //  * @notice Verify an transaction
    //  * @param _to The root of the tree we are verifying inclusion for.
    //  * @param _dataBlock The data block we're verifying inclusion for.
    //  * @param _path The path from the leaf to the root.
    //  * @param _siblings The sibling nodes along the way.
    //  * @param _root The root of the tree we are verifying inclusion for.
    //  * @param _dataBlock The data block we're verifying inclusion for.
    //  * @param _path The path from the leaf to the root.
    //  * @param _siblings The sibling nodes along the way.
    //  * @param _root The root of the tree we are verifying inclusion for.
    //  * @param _dataBlock The data block we're verifying inclusion for.
    //  * @param _path The path from the leaf to the root.
    //  * @param _siblings The sibling nodes along the way.
    //  * @return The next level of the tree
    //  */    
    //  function verifyTx(
    //     uint256 _to, uint256 _from, uint256 _amount,
    //     uint256 _nonce,uint256 _txType, uint256 _sig,
    //     uint256 _prevBatchIndex,
    //     bytes[] memory _toMerkleProof, bytes[]  memory _fromMerkleProof
    // ) public view {
    //     // basic input validations

    //     // check from address inclusion in balance tree
        
    //     // generate from leaf

    //     // update balance of from leaf

    //     // update balance tree

    //     // show inclusion of to in new balance leaf

    //     // generate to leaf

    //     // update balance in to leaf

    //     // update balance root

    //     // return updated balance tree, from leaf and to leaf
        
    // }

    // decodeTx decodes from transaction bytes to struct
    function decodeTx(bytes memory tx_bytes) public view {
        
    }
    
    
}