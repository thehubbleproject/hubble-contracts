pragma solidity ^0.5.15;

import { BLS } from "../libs/BLS.sol";

contract TestBLS {
    function verifyMultiple(
        uint256[2] calldata signature,
        uint256[4][] calldata pubkeys,
        uint256[2][] calldata messages
    ) external view returns (bool) {
        return BLS.verifyMultiple(signature, pubkeys, messages);
    }

    function verifyMultipleGasCost(
        uint256[2] calldata signature,
        uint256[4][] calldata pubkeys,
        uint256[2][] calldata messages
    ) external returns (uint256) {
        uint256 g = gasleft();
        require(
            BLS.verifyMultiple(signature, pubkeys, messages),
            "BLSTest: expect succesful verification"
        );
        return g - gasleft();
    }

    function verifySingle(
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        uint256[2] calldata message
    ) external view returns (bool) {
        return BLS.verifySingle(signature, pubkey, message);
    }

    function verifySingleeGasCost(
        uint256[2] calldata signature,
        uint256[4] calldata pubkey,
        uint256[2] calldata message
    ) external returns (uint256) {
        uint256 g = gasleft();
        require(
            BLS.verifySingle(signature, pubkey, message),
            "BLSTest: expect succesful verification"
        );
        return g - gasleft();
    }

    function hashToPoint(bytes calldata data)
        external
        view
        returns (uint256[2] memory p)
    {
        return BLS.hashToPoint(data);
    }

    function hashToPointGasCost(bytes calldata data)
        external
        returns (uint256 p)
    {
        uint256 g = gasleft();
        BLS.hashToPoint(data);
        return g - gasleft();
    }

    function isOnCurveG1Compressed(uint256 point) external view returns (bool) {

            uint256 FIELD_MASK
         = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        return BLS.isOnCurveG1(point & FIELD_MASK);
    }

    function isOnCurveG1(uint256[2] calldata point)
        external
        pure
        returns (bool)
    {
        return BLS.isOnCurveG1(point);
    }

    function isOnCurveG1CompressedGasCost(uint256 point)
        external
        returns (uint256)
    {
        uint256 g = gasleft();
        BLS.isOnCurveG1(point);
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

    function isOnCurveG2Compressed(uint256[2] calldata point)
        external
        view
        returns (bool)
    {

            uint256 FIELD_MASK
         = 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
        uint256 x0 = point[0] & FIELD_MASK;
        uint256 x1 = point[1];
        return BLS.isOnCurveG2([x0, x1]);
    }

    function isOnCurveG2(uint256[4] calldata point)
        external
        pure
        returns (bool)
    {
        return BLS.isOnCurveG2(point);
    }

    function isOnCurveG2CompressedGasCost(uint256[2] calldata point)
        external
        returns (uint256)
    {
        uint256 g = gasleft();
        BLS.isOnCurveG2(point);
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

    function isNonResidueFP(uint256 e) external view returns (bool) {
        return BLS.isNonResidueFP(e);
    }

    function isNonResidueFPGasCost(uint256 e) external returns (uint256) {
        uint256 g = gasleft();
        BLS.isNonResidueFP(e);
        return g - gasleft();
    }

    function isNonResidueFP2(uint256[2] calldata e)
        external
        view
        returns (bool)
    {
        return BLS.isNonResidueFP2(e);
    }

    function isNonResidueFP2GasCost(uint256[2] calldata e)
        external
        returns (uint256)
    {
        uint256 g = gasleft();
        BLS.isNonResidueFP2(e);
        return g - gasleft();
    }

    function pubkeyToUncompresed(
        uint256[2] calldata compressed,
        uint256[2] calldata y
    ) external pure returns (uint256[4] memory uncompressed) {
        return BLS.pubkeyToUncompresed(compressed, y);
    }

    function signatureToUncompresed(uint256 compressed, uint256 y)
        external
        pure
        returns (uint256[2] memory uncompressed)
    {
        return BLS.signatureToUncompresed(compressed, y);
    }

    function isValidCompressedPublicKey(uint256[2] calldata compressed)
        external
        view
        returns (bool)
    {
        return BLS.isValidCompressedPublicKey(compressed);
    }

    function isValidCompressedSignature(uint256 compressed)
        external
        view
        returns (bool)
    {
        return BLS.isValidCompressedSignature(compressed);
    }
}
