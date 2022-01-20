// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import { Transition } from "./libs/Transition.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { Authenticity } from "./libs/Authenticity.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract Create2Transfer {
    using Tx for bytes;
    using SafeMath for uint256;

    function checkSignature(
        Types.AuthCommon memory common,
        Types.SignatureProofWithReceiver memory proof
    ) public view returns (Types.Result) {
        return Authenticity.verifyCreate2Transfer(common, proof);
    }

    /**
     * @notice processes the state transition of a commitment
     * */
    function processCreate2TransferCommit(
        bytes32 currentStateRoot,
        bytes32 postStateRoot,
        uint256 maxTxSize,
        uint256 feeReceiver,
        bytes memory txs,
        Types.StateMerkleProof[] memory proofs
    ) public pure returns (Types.Result result) {
        if (txs.create2TransferHasExcessData())
            return Types.Result.BadCompression;
        uint256 size = txs.create2TransferSize();
        if (size > maxTxSize) return Types.Result.TooManyTx;

        uint256 fees = 0;
        // tokenID should be the same for all states in this commit
        uint256 tokenID = proofs[0].state.tokenID;
        Tx.Create2Transfer memory _tx;

        for (uint256 i = 0; i < size; i++) {
            _tx = txs.create2TransferDecode(i);
            (currentStateRoot, result) = Transition.processCreate2Transfer(
                currentStateRoot,
                _tx,
                tokenID,
                proofs[i * 2],
                proofs[i * 2 + 1]
            );
            if (result != Types.Result.Ok) return result;
            // Only trust fees when the result is good
            fees = fees.add(_tx.fee);
        }
        (currentStateRoot, result) = Transition.processReceiver(
            currentStateRoot,
            feeReceiver,
            tokenID,
            fees,
            proofs[size * 2]
        );

        if (result != Types.Result.Ok) return result;
        if (currentStateRoot != postStateRoot)
            return Types.Result.InvalidPostStateRoot;
        return result;
    }
}
