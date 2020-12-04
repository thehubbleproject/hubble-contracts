pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Transition } from "./libs/Transition.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { Authenticity } from "./libs/Authenticity.sol";

contract Transfer {
    using SafeMath for uint256;
    using Tx for bytes;

    function checkSignature(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.Result) {
        return
            Authenticity.verifyTransfer(
                signature,
                proof,
                stateRoot,
                accountRoot,
                domain,
                txs
            );
    }

    /**
     * @notice processes the state transition of a commitment
     * */
    function processTransferCommit(
        bytes32 stateRoot,
        uint256 maxTxSize,
        uint256 feeReceiver,
        bytes memory txs,
        Types.StateMerkleProof[] memory proofs
    ) public pure returns (bytes32, Types.Result result) {
        if (txs.transferHasExcessData())
            return (stateRoot, Types.Result.BadCompression);

        uint256 size = txs.transferSize();
        if (size > maxTxSize) return (stateRoot, Types.Result.TooManyTx);

        uint256 fees = 0;
        // tokenID should be the same for all states in this commit
        uint256 tokenID = proofs[0].state.tokenID;
        Tx.Transfer memory _tx;

        for (uint256 i = 0; i < size; i++) {
            _tx = txs.transferDecode(i);
            (stateRoot, result) = Transition.processTransfer(
                stateRoot,
                _tx,
                tokenID,
                proofs[i * 2],
                proofs[i * 2 + 1]
            );
            if (result != Types.Result.Ok) return (stateRoot, result);
            // Only trust fees when the result is good
            fees = fees.add(_tx.fee);
        }
        (stateRoot, result) = Transition.processReceiver(
            stateRoot,
            feeReceiver,
            tokenID,
            fees,
            proofs[size * 2]
        );

        return (stateRoot, result);
    }
}
