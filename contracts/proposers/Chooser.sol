pragma solidity ^0.5.15;

interface Chooser {
    function getProposer(uint256 batchID) external returns (address proposer);
}
