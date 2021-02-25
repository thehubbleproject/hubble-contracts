// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { DepositManager } from "../DepositManager.sol";
import { BLSAccountRegistry } from "../BLSAccountRegistry.sol";

contract FrontendUtilities {
    DepositManager public depositManager;
    BLSAccountRegistry public accountRegistry;

    constructor(
        DepositManager _depositManager,
        BLSAccountRegistry _accountRegistry
    ) public {
        depositManager = _depositManager;
        accountRegistry = _accountRegistry;
    }

    function registerMultiple(uint256[4][] calldata pubkeys)
        external
        returns (uint256)
    {
        for (uint256 i = 0; i < pubkeys.length; i++) {
            accountRegistry.register(pubkeys[i]);
        }
    }

    function deposit(
        uint256[4] calldata pubkey,
        uint256 amount,
        uint256 tokenID
    ) external {
        uint256 pubkeyID = accountRegistry.register(pubkey);
        depositManager.depositFor(msg.sender, pubkeyID, amount, tokenID);
    }

    function depositMultiple(
        uint256[4][] calldata pubkeys,
        uint256 amount,
        uint256 tokenID
    ) external returns (uint256) {
        for (uint256 i = 0; i < pubkeys.length; i++) {
            uint256 pubkeyID = accountRegistry.register(pubkeys[i]);
            depositManager.depositFor(msg.sender, pubkeyID, amount, tokenID);
        }
    }
}
