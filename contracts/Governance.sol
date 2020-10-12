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

    function MAX_DEPOSIT_SUBTREE() public view returns (uint256) {
        return govMaxDepositSubtree;
    }

    function TIME_TO_FINALISE() public view returns (uint256) {
        return govTimeToFinalise;
    }

    // min gas required before rollback pauses
    uint256 public govMinGasLeft = 100000;

    function MIN_GAS_LIMIT_LEFT() public view returns (uint256) {
        return govMinGasLeft;
    }

    uint256 public govMaxTxsPerBatch = 32;

    function MAX_TXS_PER_BATCH() public view returns (uint256) {
        return govMaxTxsPerBatch;
    }

    uint256 public govStakeAmount = 0.1 ether;

    function STAKE_AMOUNT() public view returns (uint256) {
        return govStakeAmount;
    }
}
