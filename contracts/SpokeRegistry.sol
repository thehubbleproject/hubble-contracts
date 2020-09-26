pragma solidity ^0.5.15;
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";

contract SpokeRegistry {
    Registry public nameRegistry;
    mapping(uint256 => address) public registeredSpokes;
    uint256 public numSpokes;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
    }

    function registerSpoke(address spokeContract) public {
        numSpokes++;
        registeredSpokes[numSpokes] = spokeContract;
    }

    function getSpokeAddress(uint256 spokeID) external returns (address) {
        return registeredSpokes[spokeID];
    }
}
