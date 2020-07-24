pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {BurnConsent} from "../BurnConsent.sol";
import {BLSAccountRegistry} from "../BLSAccountRegistry.sol";
import {MerkleTreeUtils} from "../MerkleTreeUtils.sol";

contract TestBurnConsentRollup is BurnConsent {
    constructor(
        BLSAccountRegistry _accountRegistry,
        MerkleTreeUtils _merkleTreeUtils
    ) public {
        accountRegistry = _accountRegistry;
        merkleUtils = _merkleTreeUtils;
    }
}
