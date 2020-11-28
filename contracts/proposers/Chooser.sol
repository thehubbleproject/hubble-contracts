pragma solidity ^0.5.15;

interface Chooser {
    /**
     * @dev Gets a proposer that is eligible to submit a batch
     */
    function getProposer() external view returns (address proposer);
}
