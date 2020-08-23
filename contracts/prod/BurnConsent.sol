pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { BurnConsent } from "../BurnConsent.sol";
import { MerkleTreeUtils as MTUtils } from "../MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "../NameRegistry.sol";
import { ParamManager } from "../libs/ParamManager.sol";

contract BurnConsentProduction is BurnConsent {
    constructor(Registry _registry) public {
        nameRegistry = _registry;
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
    }
}
