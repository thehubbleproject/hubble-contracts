pragma solidity ^0.5.15;


/*
Governance contract handles all the proof of burn related functionality
*/
contract Governance {
    address public coordinator;

    constructor() public {
        coordinator = msg.sender;
    }

    function getCoordinator() public view returns (address) {
        return coordinator;
    }
}
