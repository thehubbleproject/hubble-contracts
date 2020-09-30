pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { FraudProofHelpers } from "./libs/FraudProofHelpers.sol";
import { Types } from "./libs/Types.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";

import { BLS } from "./libs/BLS.sol";
import { Tx } from "./libs/Tx.sol";

contract Transfer {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.UserState;

    function checkSignature(
        uint256[2] memory signature,
        Types.SignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 domain,
        bytes memory txs
    ) public view returns (Types.ErrorCode) {
        uint256 batchSize = txs.transfer_size();
        uint256[2][] memory messages = new uint256[2][](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            Tx.Transfer memory _tx = txs.transfer_decode(i);
            // check state inclustion
            require(
                MerkleTreeUtilsLib.verifyLeaf(
                    stateRoot,
                    keccak256(proof.states[i].encode()),
                    _tx.fromIndex,
                    proof.stateWitnesses[i]
                ),
                "Rollup: state inclusion signer"
            );

            // check pubkey inclusion
            require(
                MerkleTreeUtilsLib.verifyLeaf(
                    accountRoot,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.states[i].pubkeyIndex,
                    proof.pubkeyWitnesses[i]
                ),
                "Rollup: account does not exists"
            );

            // construct the message
            require(proof.states[i].nonce > 0, "Rollup: zero nonce");
            bytes memory txMsg = txs.transfer_messageOf(
                i,
                proof.states[i].nonce - 1
            );
            // make the message
            messages[i] = BLS.hashToPoint(domain, txMsg);
        }
        if (!BLS.verifyMultiple(signature, proof.pubkeys, messages)) {
            return Types.ErrorCode.BadSignature;
        }
        return Types.ErrorCode.NoError;
    }

    /**
     * @notice processes the state transition of a commitment
     * @return updatedRoot, txRoot and if the batch is valid or not
     * */
    function processTransferCommit(
        bytes32 stateRoot,
        bytes memory txs,
        Types.StateMerkleProof[] memory proofs,
        uint256 tokenType,
        uint256 feeReceiver
    ) public pure returns (bytes32, bool) {
        uint256 length = txs.transfer_size();

        bool isTxValid;
        uint256 fees;
        Tx.Transfer memory _tx;

        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            _tx = txs.transfer_decode(i);
            fees = fees.add(_tx.fee);
            (stateRoot, , , , isTxValid) = processTx(
                stateRoot,
                _tx,
                tokenType,
                proofs[i * 2],
                proofs[i * 2 + 1]
            );
            if (!isTxValid) {
                break;
            }
        }
        if (isTxValid) {
            (stateRoot, , isTxValid) = processFee(
                stateRoot,
                fees,
                tokenType,
                feeReceiver,
                proofs[length * 2]
            );
        }

        return (stateRoot, !isTxValid);
    }

    /**
     * @notice processTx processes a transactions and returns the updated balance tree
     *  and the updated leaves
     * conditions in require mean that the dispute be declared invalid
     * if conditons evaluate if the coordinator was at fault
     * @return Total number of batches submitted onchain
     */
    function processTx(
        bytes32 stateRoot,
        Tx.Transfer memory _tx,
        uint256 tokenType,
        Types.StateMerkleProof memory from,
        Types.StateMerkleProof memory to
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
        require(
            MerkleTreeUtilsLib.verifyLeaf(
                stateRoot,
                keccak256(from.state.encode()),
                _tx.fromIndex,
                from.witness
            ),
            "Transfer: sender does not exist"
        );

        Types.ErrorCode err_code = FraudProofHelpers.validateTxBasic(
            _tx.amount,
            _tx.fee,
            from.state
        );
        if (err_code != Types.ErrorCode.NoError)
            return (bytes32(0), "", "", err_code, false);

        if (from.state.tokenType != tokenType) {
            return (
                bytes32(0),
                "",
                "",
                Types.ErrorCode.BadFromTokenType,
                false
            );
        }

        if (to.state.tokenType != tokenType)
            return (bytes32(0), "", "", Types.ErrorCode.BadToTokenType, false);

        bytes32 newRoot;
        bytes memory newFromState;
        bytes memory newToState;

        (newFromState, newRoot) = ApplyTransferTxSender(from, _tx);

        require(
            MerkleTreeUtilsLib.verifyLeaf(
                newRoot,
                keccak256(to.state.encode()),
                _tx.toIndex,
                to.witness
            ),
            "Transfer: receiver does not exist"
        );

        (newToState, newRoot) = ApplyTransferTxReceiver(to, _tx);

        return (
            newRoot,
            newFromState,
            newToState,
            Types.ErrorCode.NoError,
            true
        );
    }

    function ApplyTransferTxSender(
        Types.StateMerkleProof memory _merkle_proof,
        Tx.Transfer memory _tx
    ) public pure returns (bytes memory newState, bytes32 newRoot) {
        Types.UserState memory state = _merkle_proof.state;
        state.balance = state.balance.sub(_tx.amount).sub(_tx.fee);
        state.nonce++;
        bytes memory encodedState = state.encode();
        newRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(encodedState),
            _tx.fromIndex,
            _merkle_proof.witness
        );
        return (encodedState, newRoot);
    }

    function ApplyTransferTxReceiver(
        Types.StateMerkleProof memory _merkle_proof,
        Tx.Transfer memory _tx
    ) public pure returns (bytes memory newState, bytes32 newRoot) {
        Types.UserState memory state = _merkle_proof.state;
        state.balance = state.balance.add(_tx.amount);
        bytes memory encodedState = state.encode();
        newRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(encodedState),
            _tx.toIndex,
            _merkle_proof.witness
        );
        return (encodedState, newRoot);
    }

    function processFee(
        bytes32 stateRoot,
        uint256 fees,
        uint256 tokenType,
        uint256 feeReceiver,
        Types.StateMerkleProof memory stateLeafProof
    )
        public
        pure
        returns (
            bytes32 newRoot,
            Types.ErrorCode err,
            bool isValid
        )
    {
        Types.UserState memory state = stateLeafProof.state;
        if (state.tokenType != tokenType) {
            return (bytes32(0), Types.ErrorCode.BadToTokenType, false);
        }
        require(
            MerkleTreeUtilsLib.verifyLeaf(
                stateRoot,
                keccak256(state.encode()),
                feeReceiver,
                stateLeafProof.witness
            ),
            "Transfer: fee receiver does not exist"
        );
        state.balance = state.balance.add(fees);
        newRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(state.encode()),
            feeReceiver,
            stateLeafProof.witness
        );
        return (newRoot, Types.ErrorCode.NoError, true);
    }
}
