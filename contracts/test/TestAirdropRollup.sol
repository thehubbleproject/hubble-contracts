pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Airdrop} from "../airdrop.sol";
import {RollupUtils} from "../libs/RollupUtils.sol";
import {Types} from "../libs/Types.sol";
import {BLSAccountRegistry} from "../BLSAccountRegistry.sol";
import {MerkleTreeUtils} from "../MerkleTreeUtils.sol";

contract TestAirdropRollup is Airdrop {
    constructor(
        BLSAccountRegistry _accountRegistry,
        MerkleTreeUtils _merkleTreeUtils
    ) public {
        accountRegistry = _accountRegistry;
        merkleUtils = _merkleTreeUtils;
    }
}
