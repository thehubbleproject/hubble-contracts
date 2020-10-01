pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { FraudProofHelpers } from "./libs/FraudProofHelpers.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";

contract MassMigration {
    using SafeMath for uint256;
    using Tx for bytes;
    using Types for Types.UserState;
    uint256 constant BURN_STATE_INDEX = 0;

    /**
     * @notice processes the state transition of a commitment
     * @param stateRoot represents the state before the state transition
     * @return updatedRoot, txRoot and if the batch is valid or not
     * */
    function processMassMigrationCommit(
        bytes32 stateRoot,
        Types.MassMigrationBody memory commitmentBody,
        Types.StateMerkleProof[] memory proofs
    ) public view returns (bytes32, bool) {
        uint256 length = commitmentBody.txs.massMigration_size();

        bool isTxValid;
        // contains a bunch of variables to bypass STD
        // [tokenInTx0, tokenInTxUnderValidation, amountAggregationVar, spokeIDForCommitment]
        uint256[] memory metaInfoCounters = new uint256[](4);
        Tx.MassMigration memory _tx;

        for (uint256 i = 0; i < length; i++) {
            _tx = commitmentBody.txs.massMigration_decode(i);

            // ensure the transaction is to burn state
            if (_tx.toIndex != BURN_STATE_INDEX) {
                break;
            }

            if (i == 0) {
                metaInfoCounters[3] = _tx.spokeID;
            } else if (metaInfoCounters[3] != _tx.spokeID) {
                // commitment should have same spokeID, slash
                break;
            }

            // aggregate amounts from all transactions
            metaInfoCounters[2] += _tx.amount;

            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (
                stateRoot,
                ,
                ,
                metaInfoCounters[1],
                ,
                isTxValid
            ) = processMassMigrationTx(stateRoot, _tx, proofs[i]);

            // cache token of first tx to evaluate others
            if (i == 0) {
                metaInfoCounters[0] = metaInfoCounters[1];
            }
            // all transactions in same commitment should have same token
            if (metaInfoCounters[0] != metaInfoCounters[1]) {
                break;
            }

            // TODO do a withdraw root check

            if (!isTxValid) {
                break;
            }
        }

        // if amount aggregation is incorrect, slash!
        if (metaInfoCounters[2] != commitmentBody.amount) {
            return (stateRoot, false);
        }

        return (stateRoot, !isTxValid);
    }

    function processMassMigrationTx(
        bytes32 stateRoot,
        Tx.MassMigration memory _tx,
        Types.StateMerkleProof memory from
    )
        public
        pure
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            uint256,
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
            "MassMigration: sender does not exist"
        );
        Types.ErrorCode err_code = FraudProofHelpers.validateTxBasic(
            _tx.amount,
            _tx.fee,
            from.state
        );
        if (err_code != Types.ErrorCode.NoError)
            return (bytes32(0), "", "", 0, err_code, false);

        bytes32 newRoot;
        bytes memory newFromState;
        (newFromState, newRoot) = ApplyMassMigrationTxSender(from, _tx);

        return (
            newRoot,
            newFromState,
            "",
            from.state.tokenType,
            Types.ErrorCode.NoError,
            true
        );
    }

    function ApplyMassMigrationTxSender(
        Types.StateMerkleProof memory _merkle_proof,
        Tx.MassMigration memory _tx
    ) public pure returns (bytes memory newState, bytes32 newRoot) {
        Types.UserState memory state = _merkle_proof.state;
        state.balance = state.balance.sub(_tx.amount);
        state.nonce++;
        bytes memory encodedState = state.encode();
        newRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(encodedState),
            _tx.fromIndex,
            _merkle_proof.witness
        );
        return (encodedState, newRoot);
    }
}
