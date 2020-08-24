pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Transfer } from "../Transfer.sol";
import { Types } from "../libs/Types.sol";
import { MerkleTreeUtils } from "../MerkleTreeUtils.sol";

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

    function testProcessTx(
        bytes32 _balanceRoot,
        bytes memory txs,
        uint256 i,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        return processTx(_balanceRoot, txs, i, _from_pda_proof, accountProofs);
    }
}
