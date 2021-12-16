// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

contract SpokeRegistry {
    event RegisteredSpoke(uint256 spokeID, address spokeContract);

    mapping(uint256 => address) public registeredSpokes;
    uint256 public numSpokes;

    function registerSpoke(address spokeContract) external {
        numSpokes++;
        registeredSpokes[numSpokes] = spokeContract;
        emit RegisteredSpoke(numSpokes, spokeContract);
    }

    function getSpokeAddress(uint256 spokeID) external view returns (address) {
        return registeredSpokes[spokeID];
    }
}
