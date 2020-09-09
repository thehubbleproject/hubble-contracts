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
        bytes memory txs,
        Types.AccountMerkleProof[] memory accountProofs
    ) public pure returns (bytes32, bool) {
        uint256 length = txs.transfer_size();
        bool isTxValid;
        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , , isTxValid) = processAirdropTx(
                stateRoot,
                txs,
                i,
                accountProofs[i * 2],
                accountProofs[i * 2 + 1]
            );

            if (!isTxValid) {
                break;
            }
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
    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes memory txs,
        uint256 i,
        Types.AccountMerkleProof memory fromAccountProof,
        Types.AccountMerkleProof memory toAccountProof
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
        Types.ErrorCode err_code = validateTxBasic(
            txs.transfer_amountOf(i),
            0,
            fromAccountProof.account
        );
        if (err_code != Types.ErrorCode.NoError)
            return (ZERO_BYTES32, "", "", err_code, false);

        // account holds the token type in the tx
        if (
            fromAccountProof.account.tokenType !=
            toAccountProof.account.tokenType
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

        (new_from_account, newRoot) = ApplyAirdropTx(fromAccountProof, txs, i);

        (new_to_account, newRoot) = ApplyAirdropTx(toAccountProof, txs, i);

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
    ) public pure returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory stateLeaf = _merkle_proof.account;
        uint256 stateIndex = _merkle_proof.pathToAccount;
        if (stateIndex == txs.transfer_fromIndexOf(i)) {
            stateLeaf = RemoveTokensFromAccount(
                stateLeaf,
                txs.transfer_amountOf(i)
            );
            stateLeaf.nonce++;
        }

        if (stateIndex == txs.transfer_toIndexOf(i)) {
            stateLeaf = AddTokensToAccount(stateLeaf, txs.transfer_amountOf(i));
        }
        newRoot = UpdateAccountWithSiblings(stateLeaf, _merkle_proof);

        return (RollupUtils.BytesFromAccount(stateLeaf), newRoot);
    }
}
