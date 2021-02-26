// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import { Chooser } from "../proposers/Chooser.sol";

contract ProofOfBurn is Chooser {
    address public coordinator;

    constructor() public {
        coordinator = msg.sender;
    }

    function getProposer() external view override returns (address) {
        return coordinator;
    }
}
