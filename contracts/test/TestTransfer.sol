pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Transfer } from "../Transfer.sol";
import { Types } from "../libs/Types.sol";
import { Tx } from "../libs/Tx.sol";

contract TestTransfer is Transfer {
    event Return1(uint256);
    event Return2(Types.ErrorCode);

    function checkSignature(
        uint256[2] memory signature,
        InvalidSignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 appID,
        bytes memory txs
    ) public {
        uint256 operationCost = gasleft();
        Types.ErrorCode err = _checkSignature(
            signature,
            proof,
            stateRoot,
            accountRoot,
            appID,
            txs
        );

        emit Return1(operationCost - gasleft());
        emit Return2(err);
    }

    function testProcessTx(
        bytes32 _balanceRoot,
        Tx.Transfer memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        pure
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        return processTx(_balanceRoot, _tx, _from_pda_proof, accountProofs);
    }
}
