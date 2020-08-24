pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract BurnConsent is FraudProofHelpers {
    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processBurnConsentBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.BatchValidationProofs memory batchProofs,
        bytes32 expectedTxHashCommitment
    )
        public
        pure
        returns (
            bytes32,
            bytes32,
            bool
        )
    {
        uint256 length = txs.burnConsent_size();
        bytes32 actualTxHashCommitment = keccak256(txs);
        if (expectedTxHashCommitment != ZERO_BYTES32) {
            require(
                actualTxHashCommitment == expectedTxHashCommitment,
                "Invalid dispute, tx root doesn't match"
            );
        }

        bool isTxValid;
        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , isTxValid) = processBurnConsentTx(
                stateRoot,
                txs,
                i,
                batchProofs.accountProofs[i].from
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, actualTxHashCommitment, !isTxValid);
    }

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txs,
        uint256 i
    ) public pure returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _merkle_proof.accountIP.account;
        account.burn = txs.burnConsent_amountOf(i);
        account.nonce++;
        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);
        updatedAccount = RollupUtils.BytesFromAccount(account);
        return (updatedAccount, newRoot);
    }

    /**
     * @notice Overrides processTx in FraudProof
     */
    function processBurnConsentTx(
        bytes32 _balanceRoot,
        bytes memory txs,
        uint256 i,
        Types.AccountMerkleProof memory _fromAccountProof
    )
        public
        pure
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        Types.UserAccount memory account = _fromAccountProof.accountIP.account;

        // Validate the from account merkle proof
        ValidateAccountMP(_balanceRoot, _fromAccountProof);

        // TODO: Validate only certain token is allow to burn

        bytes32 newRoot;
        bytes memory new_from_account;
        (new_from_account, newRoot) = ApplyBurnConsentTx(
            _fromAccountProof,
            txs,
            i
        );

        return (newRoot, new_from_account, Types.ErrorCode.NoError, true);
    }
}
