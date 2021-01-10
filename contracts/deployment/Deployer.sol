pragma solidity ^0.5.15;

import { Proxy } from "./Proxy.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract Deployer {
    uint8 internal CREATE2_PREFIX = 0xff;

    function deploy(address implementation, bytes32 salt)
        external
        returns (Proxy proxy)
    {
        require(
            !Address.isContract(_calculateAddress(salt)),
            "Deployer: salt is used"
        );

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
}
