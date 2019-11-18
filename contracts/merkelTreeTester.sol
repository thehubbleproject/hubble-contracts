
pragma solidity ^0.5.0;

import "./merkelTreeLib.sol";

contract MerkleTreeTester is MerkleTree {
    constructor() MerkleTree(2, 4) public {

    }
    function insert_test(uint256 leaf) public {
        insert(leaf);
    }
}