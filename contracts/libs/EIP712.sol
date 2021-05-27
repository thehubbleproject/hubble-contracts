// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

/**
 * @notice Interface for contracts which inherit @openzeppelin/contracts EIP712 and need to expose it for external use.
 * @dev If @openzeppelin/contracts EIP712 exposes a public function for this in the future, use that instead.
 */
interface IEIP712 {
    /**
     * @notice Do not cache this value. If `chainid` changes it will differ on subsequent calls.
     * @return EIP-712 domainSeparator
     */
    function domainSeparator() external view returns (bytes32);
}
