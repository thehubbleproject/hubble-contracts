pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Transfer } from "../Transfer.sol";
import { Types } from "../libs/Types.sol";

contract TestTransfer is Transfer {
    function checkSignature(
        uint256[2] memory signature,
        InvalidSignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 appID,
        bytes memory txs
    ) public returns (Types.ErrorCode, uint256 operationCost) {
        operationCost = gasleft();
        return (
            _checkSignature(
                signature,
                proof,
                stateRoot,
                accountRoot,
                appID,
                txs
            ),
            operationCost - gasleft()
        );
    }
}
