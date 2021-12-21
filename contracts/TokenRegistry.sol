// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ITokenRegistry {
    event RegisteredToken(uint256 tokenID, address tokenContract);

    function safeGetRecord(uint256 tokenID)
        external
        view
        returns (address, uint256 l2Unit);

    function registerToken(address tokenContract) external;
}

contract TokenRegistry is ITokenRegistry {
    struct Record {
        address addr;
        bool useL2Unit;
    }
    mapping(uint256 => Record) private registeredTokens;
    mapping(address => bool) private registeredContracts;

    uint256 public nextTokenID = 0;

    function safeGetRecord(uint256 tokenID)
        external
        view
        override
        returns (address, uint256 l2Unit)
    {
        Record memory record = registeredTokens[tokenID];
        require(
            record.addr != address(0),
            "TokenRegistry: Unregistered tokenID"
        );
        l2Unit = 1;
        if (record.useL2Unit) {
            l2Unit = 10**9;
        }

        return (record.addr, l2Unit);
    }

    function registerToken(address tokenContract) public override {
        require(
            !registeredContracts[tokenContract],
            "Token already registered."
        );
        require(
            ERC20(tokenContract).decimals() <= 18,
            "Don't serve decimals > 18"
        );

        bool useL2Unit = ERC20(tokenContract).decimals() >= 9;
        registeredTokens[nextTokenID] = Record({
            addr: tokenContract,
            useL2Unit: useL2Unit
        });
        registeredContracts[tokenContract] = true;

        emit RegisteredToken(nextTokenID, tokenContract);
        nextTokenID++;
    }
}
