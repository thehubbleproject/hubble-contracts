pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { NameRegistry } from "../NameRegistry.sol";
import { DepositManager } from "../DepositManager.sol";
import { BLSAccountRegistry } from "../BLSAccountRegistry.sol";
import { ParamManager } from "../libs/ParamManager.sol";

contract FrontendUtilities {
    NameRegistry public nameRegistry;
    DepositManager public depositManager;
    BLSAccountRegistry public accountRegistry;

    constructor(NameRegistry registry) public {
        nameRegistry = registry;
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.depositManager())
        );
        accountRegistry = BLSAccountRegistry(
            nameRegistry.getContractDetails(ParamManager.accountRegistry())
        );
    }

    function deposit(
        uint256[4] calldata pubkey,
        uint256 amount,
        uint256 tokenID
    ) external {
        uint256 pubkeyID = accountRegistry.register(pubkey);
        depositManager.depositFor(pubkeyID, amount, tokenID);
    }
}
