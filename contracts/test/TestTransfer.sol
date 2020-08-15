pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Transfer } from "../Transfer.sol";
import { Types } from "../libs/Types.sol";
import { MerkleTreeUtils } from "../MerkleTreeUtils.sol";

contract TestTransfer is Transfer {
    constructor(MerkleTreeUtils _merkleUtils) public {
        merkleUtils = _merkleUtils;
    }

    function checkSignature(
        uint256[2] memory signature,
        TransferSignatureProof memory proof,
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

    function processTransferCommitment(
        bytes32 stateRoot,
        bytes memory txs,
        AccountsProof[] memory proof
    )
        public
        returns (
            bytes32,
            bool,
            uint256 operationCost
        )
    {
        operationCost = gasleft();
        (bytes32 state, bool safe) = _processTransferCommitment(
            stateRoot,
            txs,
            proof
        );
        return (state, safe, operationCost - gasleft());
    }
}
