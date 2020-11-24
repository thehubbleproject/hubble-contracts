pragma solidity ^0.5.15;

interface Chooser {
    /**
     * @dev Gets a proposer that is eligible to submit a batch and also mark it as submitted
     */
    function checkOffProposer() external returns (address proposer);
}
