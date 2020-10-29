pragma solidity ^0.5.15;

/*
Governance contract handles all the proof of burn related functionality
*/
contract Governance {
    uint256 private govMaxDepositSubtree = 0;
    uint256 private govTimeToFinalise = 0;

    constructor(uint256 maxDepositSubTree, uint256 timeToFinalise) public {
        govMaxDepositSubtree = maxDepositSubTree;
        govTimeToFinalise = timeToFinalise;
    }

    function maxDepositSubtree() public view returns (uint256) {
        return govMaxDepositSubtree;
    }

    function timeToFinalise() public view returns (uint256) {
        return govTimeToFinalise;
    }

    // min gas required before rollback pauses
    uint256 public govMinGasLeft = 100000;

    function minGasLeft() public view returns (uint256) {
        return govMinGasLeft;
    }

    uint256 public govMaxTxsPerCommit = 32;

    function maxTxsPerCommit() public view returns (uint256) {
        return govMaxTxsPerCommit;
    }

    uint256 public govStakeAmount = 0.1 ether;

    function stakeAmount() public view returns (uint256) {
        return govStakeAmount;
    }
}
