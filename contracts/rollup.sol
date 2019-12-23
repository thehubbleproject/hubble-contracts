pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import {MerkleTree as MerkleTreeUtil} from "./merkleTreeLib.sol";


contract Rollup {
    MerkleTreeUtil merkelTreeUtil;
    constructor(address merkleTreeLib) public{
        merkelTreeUtil = MerkleTreeUtil(merkleTreeLib);
        initAccounts();
    }
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
    
    event NewBatch(bytes32 txroot, bytes32 updatedRoot);
    event NewAccount(bytes32 root, uint256 index);
    
    function numberOfBatches() public view returns (uint256){
        return batches.length;
    }

    function updateTx(bytes memory _tx,uint256 tx_from,uint256 tx_to,uint256 tx_amount,bytes memory proof_from,bytes memory proof_to) public {

    }
    // function addAccount(uint256 accountTreeIndex, uint256 token ,uint256 balance, uint256 nonce)public{
    //     bytes memory data = abi.encodePacked(accountTreeIndex,token,balance,nonce);
    //     bytes32 root = merkelTreeUtil.insert(keccak256(data));
    //     uint256 index, = merkelTreeUtil.next_index-1;
    //     emit NewAccount(root,index);
    // }
    
    function initAccounts() public{
        accounts[0] = bytes("0x046af4195060cfb39a6f53a84ea8f52c4339f277acb48281476df5b9773a44394fdc5280263a7ccceaa51ed7d2a76fb1b2e4ff3275b4f027d228989d213efadb93");
        lastAccountIndex++;
        bytes memory data = abi.encodePacked(uint256(0),uint256(0),uint256(10),uint256(0));
        bytes32 root = merkelTreeUtil.insert(keccak256(data));
        balanceTreeRoot = root;
    }
    
    function submitBatch(bytes[] calldata _txs,bytes32 updatedRoot) external returns(bytes32) {
     bytes32 txRoot = merkelTreeUtil.getMerkleRoot(_txs);
     
     // make merkel root of all txs
     Batch memory newBatch = Batch({
        stateRoot: updatedRoot,
        committer: msg.sender,
        account_tree_state: ZERO_BYTES32,
        withdraw_root: ZERO_BYTES32,
        txRoot: txRoot,
        timestamp: now
     });

     batches.push(newBatch);
     emit NewBatch(txRoot,updatedRoot);
    }

    // verifyTx verifies a transaction and returns the updates leaves
    function verifyTx(uint256 to, uint256 from, uint256 amount,
    uint256 nonce,uint256 txType, uint256 sig,
    uint256 last_batch_index, bytes[] memory to_merkel_proof, bytes[]  memory from_merkel_proof) public view {
        // basic input validations

        // check from address inclusion in balance tree
        
        // generate from leaf

        // update balance of from leaf

        // update balance tree

        // show inclusion of to in new balance leaf

        // generate to leaf

        // update balance in to leaf

        // update balance root

        // return updated balance tree, from leaf and to leaf
        
    }

    // decodeTx decodes from transaction bytes to struct
    function decodeTx(bytes memory tx_bytes) public view {
        
    }
    
    
}