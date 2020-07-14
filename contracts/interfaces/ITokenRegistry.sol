pragma solidity ^0.5.15;

// token registry contract interface
contract ITokenRegistry {
    uint256 public numTokens;
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) public registeredTokens;

    function requestTokenRegistration(address tokenContract) public {}

    function finaliseTokenRegistration(address tokenContract) public {}
}
