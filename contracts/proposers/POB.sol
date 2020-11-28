pragma solidity ^0.5.15;

import { Chooser } from "./Chooser.sol";

contract ProofOfBurn is Chooser {
    address public coordinator;

    constructor() public {
        coordinator = msg.sender;
    }

    function getProposer() external view returns (address) {
        return coordinator;
    }
}
