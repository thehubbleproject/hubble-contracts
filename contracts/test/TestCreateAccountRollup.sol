pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {CreateAccount} from "../CreateAccount.sol";
import {MerkleTreeUtils} from "../MerkleTreeUtils.sol";

contract TestCreateAccountRollup is CreateAccount {
    constructor(MerkleTreeUtils _merkleTreeUtils) public {
        merkleUtils = _merkleTreeUtils;
    }
}
