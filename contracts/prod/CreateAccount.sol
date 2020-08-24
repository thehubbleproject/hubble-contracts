pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { CreateAccount } from "../CreateAccount.sol";
import { NameRegistry as Registry } from "../NameRegistry.sol";
import { ParamManager } from "../libs/ParamManager.sol";
import { ITokenRegistry } from "../interfaces/ITokenRegistry.sol";

contract CreateAccountProduction is CreateAccount {
    constructor(Registry _registry) public {
        nameRegistry = _registry;
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
    }
}
