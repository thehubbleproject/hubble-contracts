pragma solidity ^0.5.15;

interface Chooser {
    function getProposer() external view returns (address proposer);
}
