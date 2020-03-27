pragma solidity ^0.5.0;


// token registry contract interface
contract ITokenRegistry {
    address public Coordinator;
    uint256 public numTokens;
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) public registeredTokens;

    modifier onlyCoordinator() {
        assert(msg.sender == Coordinator);
        _;
    }

    function requestTokenRegistration(address tokenContract) public {}

    function finaliseTokenRegistration(address tokenContract) public {}
}
