pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";

contract Parameters is Ownable {
    uint256 public paramStakeAmount = 0.1 ether;
    uint256 public paramBlocksToFinalise = 0;
    uint256 public paramMinGasLeft = 10000;
    uint256 public paramMaxTxsPerCommit = 32;

    function setStakeAmount(uint256 stakeAmount) external onlyOwner {
        paramStakeAmount = stakeAmount;
    }

    function setBlocksToFinalise(uint256 blocksToFinalise) external onlyOwner {
        paramBlocksToFinalise = blocksToFinalise;
    }

    function setMinGasLeft(uint256 minGasLeft) external onlyOwner {
        paramMinGasLeft = minGasLeft;
    }

    function setMaxTxsPerCommit(uint256 maxTxsPerCommit) external onlyOwner {
        paramMaxTxsPerCommit = maxTxsPerCommit;
    }
}
