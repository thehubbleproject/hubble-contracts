// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { DepositManager } from "../DepositManager.sol";
import { BLSAccountRegistry } from "../BLSAccountRegistry.sol";

contract FrontendUtilities {
    DepositManager public immutable depositManager;
    BLSAccountRegistry public immutable accountRegistry;

    constructor(
        DepositManager _depositManager,
        BLSAccountRegistry _accountRegistry
    ) public {
        depositManager = _depositManager;
        accountRegistry = _accountRegistry;
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
