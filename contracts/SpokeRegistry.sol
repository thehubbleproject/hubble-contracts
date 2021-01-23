pragma solidity ^0.6.12;

contract SpokeRegistry {
    mapping(uint256 => address) public registeredSpokes;
    uint256 public numSpokes;

    function registerSpoke(address spokeContract) external {
        numSpokes++;
        registeredSpokes[numSpokes] = spokeContract;
    }

    function getSpokeAddress(uint256 spokeID) external view returns (address) {
        return registeredSpokes[spokeID];
    }
}
