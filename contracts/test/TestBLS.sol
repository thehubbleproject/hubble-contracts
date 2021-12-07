// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

import { BLS } from "../libs/BLS.sol";

contract TestBLS {
    function verifyMultiple(
        uint256[2] calldata signature,
        uint256[4][] calldata pubkeys,
        uint256[2][] calldata messages
    ) external view returns (bool, bool) {
        return BLS.verifyMultiple(signature, pubkeys, messages);
    }

    function verifySingle(
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        uint256[2] calldata message
    ) external view returns (bool, bool) {
        return BLS.verifySingle(signature, pubkey, message);
    }

    function mapToPoint(uint256 e) external view returns (uint256[2] memory p) {
        return BLS.mapToPoint(e);
    }

    function hashToPoint(bytes32 domain, bytes calldata message)
        external
        view
        returns (uint256[2] memory p)
    {
        return BLS.hashToPoint(domain, message);
    }

    function expandMsg(bytes32 domain, bytes calldata message)
        external
        pure
        returns (bytes memory)
    {
        return BLS.expandMsgTo96(domain, message);
    }

    function hashToField(bytes32 domain, bytes calldata message)
        external
        pure
        returns (uint256[2] memory)
    {
        return BLS.hashToField(domain, message);
    }

    function isOnCurveG1(uint256[2] calldata point)
        external
        pure
        returns (bool)
    {
        return BLS.isOnCurveG1(point);
    }

    function isOnCurveG2(uint256[4] calldata point)
        external
        pure
        returns (bool)
    {
        return BLS.isOnCurveG2(point);
    }

    function verifyMultipleGasCost(
        uint256[2] calldata signature,
        uint256[4][] calldata pubkeys,
        uint256[2][] calldata messages
    ) external returns (uint256) {
        uint256 g = gasleft();
        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifyMultiple(
            signature,
            pubkeys,
            messages
        );
        require(callSuccess, "BLSTest: expect successful precompile call");
        require(checkSuccess, "BLSTest: expect successful verification");
        return g - gasleft();
    }

    function verifySingleGasCost(
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        uint256[2] calldata message
    ) external returns (uint256) {
        uint256 g = gasleft();

        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifySingle(
            signature,
            pubkey,
            message
        );
        require(callSuccess, "BLSTest: expect successful call");
        require(checkSuccess, "BLSTest: expect successful verification");
        return g - gasleft();
    }

    function hashToPointGasCost(bytes32 domain, bytes calldata message)
        external
        returns (uint256 p)
    {
        uint256 g = gasleft();
        BLS.hashToPoint(domain, message);
        return g - gasleft();
    }

    function isOnCurveG1GasCost(uint256[2] calldata point)
        external
        returns (uint256)
    {
        uint256 g = gasleft();
        BLS.isOnCurveG1(point);
        return g - gasleft();
    }

    function isOnCurveG2GasCost(uint256[4] calldata point)
        external
        returns (uint256)
    {
        uint256 g = gasleft();
        BLS.isOnCurveG2(point);
        return g - gasleft();
    }
}
