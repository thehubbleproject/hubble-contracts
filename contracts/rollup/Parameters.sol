pragma solidity ^0.6.12;

contract Parameters {
    uint256 public paramStakeAmount = 0.1 ether;
    uint256 public paramBlocksToFinalise = 0;
    uint256 public paramMinGasLeft = 10000;
    uint256 public paramMaxTxsPerCommit = 32;
}
