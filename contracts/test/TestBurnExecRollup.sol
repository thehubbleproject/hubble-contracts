pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {BurnExecution} from "../BurnExecution.sol";
import {MerkleTreeUtils} from "../MerkleTreeUtils.sol";
import {RollupUtils} from "../libs/RollupUtils.sol";

contract TestBurnExecRollup is BurnExecution {
    constructor(MerkleTreeUtils _merkleTreeUtils) public {
        merkleUtils = _merkleTreeUtils;
    }
}
