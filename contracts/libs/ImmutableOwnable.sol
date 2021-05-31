// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

/**
 * Immutable, non-transferable version of openzeppelin/contracts/access/Ownable
 */
abstract contract ImmutableOwnable {
    address private immutable _owner;

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() internal {
        _owner = msg.sender;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(
            msg.sender == _owner,
            "ImmutableOwnable: caller is not the owner"
        );
        _;
    }
}
