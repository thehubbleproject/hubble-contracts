// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import { Proxy } from "./Proxy.sol";

contract Deployer {
    uint8 private constant CREATE2_PREFIX = 0xff;

    function deploy(address implementation, bytes32 salt)
        external
        returns (Proxy proxy)
    {
        require(!isContract(_calculateAddress(salt)), "Deployer: salt is used");

        bytes memory deploymentData = getDeploymentData();

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            proxy := create2(
                0,
                add(deploymentData, 0x20),
                mload(deploymentData),
                salt
            )
            if iszero(extcodesize(proxy)) {
                revert(0, 0)
            }
        }
        proxy.__initialize__(implementation);
        return proxy;
    }

    function calculateAddress(bytes32 salt) external view returns (address) {
        return _calculateAddress(salt);
    }

    function getDeploymentData() internal view returns (bytes memory) {
        return type(Proxy).creationCode;
    }

    function _calculateAddress(bytes32 salt) internal view returns (address) {
        // prettier-ignore
        return address(uint160(uint256(keccak256(
                            abi.encodePacked(
                                CREATE2_PREFIX,
                                address(this),
                                salt,
                                keccak256(getDeploymentData())
            ) ) ) ) );
    }

    // Borrowed from openzeppelin/contracts
    function isContract(address account) internal view returns (bool) {
        // According to EIP-1052, 0x0 is the value returned for not-yet created accounts
        // and 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is returned
        // for accounts without code, i.e. `keccak256('')`
        bytes32 codehash;

        bytes32 accountHash =
            0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            codehash := extcodehash(account)
        }
        return (codehash != accountHash && codehash != 0x0);
    }
}
