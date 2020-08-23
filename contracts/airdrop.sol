pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract Airdrop is FraudProofHelpers {
    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processAirdropBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        bytes memory txs,
        Types.BatchValidationProofs memory batchProofs,
        bytes32 expectedTxHashCommitment
    )
        public
        view
        returns (
            bytes32,
            bytes32,
            bool
        )
    {
        uint256 length = txs.transfer_size();

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
            (stateRoot, , , , isTxValid) = processAirdropTx(
                stateRoot,
                accountsRoot,
                txs,
                i,
                batchProofs.pdaProof[i],
                batchProofs.accountProofs[i]
            );

            if (!isTxValid) {
                break;
            }
        }
        return (stateRoot, actualTxHashCommitment, !isTxValid);
    }

    /**
     * @notice processTx processes a transactions and returns the updated balance tree
     *  and the updated leaves
     * conditions in require mean that the dispute be declared invalid
     * if conditons evaluate if the coordinator was at fault
     * @return Total number of batches submitted onchain
     */
    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
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
        // Validate the from account merkle proof
        ValidateAccountMP(_balanceRoot, accountProofs.from);

        Types.ErrorCode err_code = validateTxBasic(
            txs.transfer_amountOf(i),
            accountProofs.from.accountIP.account
        );
        if (err_code != Types.ErrorCode.NoError)
            return (ZERO_BYTES32, "", "", err_code, false);

        // account holds the token type in the tx
        if (
            accountProofs.from.accountIP.account.tokenType !=
            accountProofs.to.accountIP.account.tokenType
        )
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (
                ZERO_BYTES32,
                "",
                "",
                Types.ErrorCode.BadFromTokenType,
                false
            );

        bytes32 newRoot;
        bytes memory new_from_account;
        bytes memory new_to_account;

        (new_from_account, newRoot) = ApplyAirdropTx(
            accountProofs.from,
            txs,
            i
        );

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(newRoot, accountProofs.to);

        (new_to_account, newRoot) = ApplyAirdropTx(accountProofs.to, txs, i);

        return (
            newRoot,
            new_from_account,
            new_to_account,
            Types.ErrorCode.NoError,
            true
        );
    }

    function ApplyAirdropTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txs,
        uint256 i
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        return
            _ApplyTx(
                _merkle_proof,
                txs.transfer_fromIndexOf(i),
                txs.transfer_toIndexOf(i),
                txs.transfer_amountOf(i)
            );
    }
}
