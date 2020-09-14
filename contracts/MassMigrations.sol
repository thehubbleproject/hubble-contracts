pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { Tx } from "./libs/Tx.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";

contract MassMigration is FraudProofHelpers {
    using Tx for bytes;
    uint256 constant BURN_STATE_INDEX = 0;

    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processMassMigsBatch(
        Types.MMCommitment memory commitment,
        Types.AccountMerkleProof[] memory accountProofs
    ) public view returns (bytes32, bool) {
        uint256 length = commitment.txs.massMigration_size();

        bool isTxValid;
        // contains a bunch of variables to bypass STD
        // [tokenInTx0, tokenInTxUnderValidation, amountAggregationVar, spokeIDForCommitment]
        uint256[] memory metaInfoCounters = new uint256[](4);
        Tx.MassMigration memory _tx;

        for (uint256 i = 0; i < length; i++) {
            _tx = commitment.txs.massMigration_decode(i);

            // ensure the transaction is to burn account
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
                commitment.stateRoot,
                ,
                ,
                metaInfoCounters[1],
                ,
                isTxValid
            ) = processMassMigrationTx(
                commitment.stateRoot,
                _tx,
                accountProofs[i * 2]
            );

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
        if (metaInfoCounters[2] != commitment.massMigrationMetaInfo.amount) {
            return (commitment.stateRoot, false);
        }

        return (commitment.stateRoot, !isTxValid);
    }

    function processMassMigrationTx(
        bytes32 stateRoot,
        Tx.MassMigration memory _tx,
        Types.AccountMerkleProof memory fromAccountProof
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
                RollupUtils.HashFromAccount(fromAccountProof.account),
                _tx.fromIndex,
                fromAccountProof.siblings
            ),
            "Transfer: sender does not exist"
        );
        Types.ErrorCode err_code = validateTxBasic(
            _tx.amount,
            _tx.fee,
            fromAccountProof.account
        );
        if (err_code != Types.ErrorCode.NoError)
            return (ZERO_BYTES32, "", "", 0, err_code, false);

        bytes32 newRoot;
        bytes memory new_from_account;
        bytes memory new_to_account;
        (new_from_account, newRoot) = ApplyMassMigrationTxSender(
            fromAccountProof,
            _tx
        );

        return (
            newRoot,
            new_from_account,
            new_to_account,
            fromAccountProof.account.tokenType,
            Types.ErrorCode.NoError,
            true
        );
    }

    function ApplyMassMigrationTxSender(
        Types.AccountMerkleProof memory _merkle_proof,
        Tx.MassMigration memory _tx
    ) public pure returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _merkle_proof.account;
        account = RemoveTokensFromAccount(account, _tx.amount);
        account.nonce++;
        bytes memory accountInBytes = RollupUtils.BytesFromAccount(account);
        newRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(accountInBytes),
            _tx.fromIndex,
            _merkle_proof.siblings
        );
        return (accountInBytes, newRoot);
    }
}
