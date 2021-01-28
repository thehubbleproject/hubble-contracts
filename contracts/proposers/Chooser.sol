// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

interface Chooser {
    /**
     * @dev Gets a proposer that is eligible to submit a batch
     */
    function getProposer() external view returns (address proposer);
}
