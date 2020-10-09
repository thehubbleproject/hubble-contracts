pragma solidity ^0.5.15;

/*
Governance contract handles all the proof of burn related functionality
*/
contract Governance {
    uint256 private _MAX_DEPOSIT_SUBTREE = 0;
    uint256 private _TIME_TO_FINALISE = 0;

    constructor(uint256 maxDepositSubTree, uint256 timeToFinalise) public {
        _MAX_DEPOSIT_SUBTREE = maxDepositSubTree;
        _TIME_TO_FINALISE = timeToFinalise;
    }

    function MAX_DEPOSIT_SUBTREE() public view returns (uint256) {
        return _MAX_DEPOSIT_SUBTREE;
    }

    function TIME_TO_FINALISE() public view returns (uint256) {
        return _TIME_TO_FINALISE;
    }

    // min gas required before rollback pauses
    uint256 public _MIN_GAS_LIMIT_LEFT = 100000;

    function MIN_GAS_LIMIT_LEFT() public view returns (uint256) {
        return _MIN_GAS_LIMIT_LEFT;
    }

    uint256 public _MAX_TXS_PER_BATCH = 32;

    function MAX_TXS_PER_BATCH() public view returns (uint256) {
        return _MAX_TXS_PER_BATCH;
    }

    uint256 public _STAKE_AMOUNT = 0.1 ether;

    function STAKE_AMOUNT() public view returns (uint256) {
        return _STAKE_AMOUNT;
    }
}
