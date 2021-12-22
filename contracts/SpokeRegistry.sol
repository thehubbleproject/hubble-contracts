// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

contract SpokeRegistry {
    event SpokeRegistered(uint256 spokeID, address spokeContract);

    mapping(uint256 => address) public registeredSpokes;
    uint256 public numSpokes;

    function registerSpoke(address spokeContract) external {
        numSpokes++;
        registeredSpokes[numSpokes] = spokeContract;
        emit SpokeRegistered(numSpokes, spokeContract);
    }

    function getSpokeAddress(uint256 spokeID) external view returns (address) {
        return registeredSpokes[spokeID];
    }
}
