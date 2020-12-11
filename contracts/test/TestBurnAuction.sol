pragma solidity ^0.5.15;

import { Chooser } from "../proposers/Chooser.sol";
import { BurnAuction } from "../proposers/BurnAuction.sol";

contract MockRollup {
    Chooser public chooser;

    constructor(Chooser _chooser) public {
        chooser = _chooser;
    }

    function submitBatch() external {
        require(chooser.getProposer() == msg.sender, "Invalid proposer");
    }
}

contract TestBurnAuction is BurnAuction {
    constructor(address payable _donationAddress)
        public
        BurnAuction(_donationAddress)
    {}

    uint256 public blockNumber = 0;

    function setBlockNumber(uint256 _blockNumber) external {
        blockNumber = _blockNumber;
    }

    function getBlockNumber() public view returns (uint256) {
        return blockNumber;
    }
}
