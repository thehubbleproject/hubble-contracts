pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree as MerkleTreeUtil} from "./merkelTreeLib.sol";


contract Rollup {
    MerkleTreeUtil merkelTreeUtil;
    constructor(address merkleTreeLib) public{
        merkelTreeUtil = MerkleTreeUtil(merkleTreeLib);
    }
    event NewBatch(bytes32 txroot, bytes32 updatedRoot);

    // Batch
    struct Batch{
        bytes32 stateRoot;
        bytes32 withdraw_root;
        address committer;
        bytes32 account_tree_state;
        bytes32 txRoot;
        uint timestamp;
    }
    
    Batch[] public batches;
    bytes32 public ACCOUNT_TREE_STATE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 public GENESIS_BALANCE_TREE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    bytes32 public ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    function updateTx(bytes memory tx_sig,address tx_from,address tx_to,uint256 tx_amount,bytes memory proof_from,bytes memory proof_to) public {
       
    }
    
    
    function submitBatch(bytes[] calldata _txs,bytes32 updatedRoot) external returns(bytes32) {
     bytes32 txRoot=merkelTreeUtil.getMerkleRoot(_txs);
     
     // make merkel root of all txs
     Batch memory newBatch = Batch({
        stateRoot: updatedRoot,
        committer: msg.sender,
        account_tree_state: ACCOUNT_TREE_STATE,
        withdraw_root: ACCOUNT_TREE_STATE,
        txRoot: txRoot,
        timestamp: now
     });
     
     batches.push(newBatch);
     emit NewBatch(txRoot,updatedRoot);
    }
    
}