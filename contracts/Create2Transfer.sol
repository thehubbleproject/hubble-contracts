pragma solidity ^0.5.15;
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
        uint256[2] memory signature,
        Types.SignatureProofWithReceiver memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.Result) {
        return
            Authenticity.verifyCreate2Transfer(
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
    function processCreate2TransferCommit(
        bytes32 stateRoot,
        bytes memory txs,
        Types.StateMerkleProof[] memory proofs,
        uint256 feeReceiver
    ) public pure returns (bytes32, Types.Result result) {
        uint256 length = txs.create2TransferSize();
        uint256 fees = 0;
        // tokenType should be the same for all states in this commit
        uint256 tokenType = proofs[0].state.tokenType;
        Tx.Create2Transfer memory _tx;

        for (uint256 i = 0; i < length; i++) {
            _tx = txs.create2TransferDecode(i);
            (stateRoot, result) = Transition.processCreate2Transfer(
                stateRoot,
                _tx,
                tokenType,
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
            tokenType,
            fees,
            proofs[length * 2]
        );

        return (stateRoot, result);
    }
}
