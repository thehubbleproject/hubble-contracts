pragma solidity ^0.5.15;

// ERC20 token interface
contract IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public returns (bool) {}

    function transfer(address recipient, uint256 value) public returns (bool) {}
}
