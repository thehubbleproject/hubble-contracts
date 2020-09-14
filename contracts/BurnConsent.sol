pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract BurnConsent is FraudProofHelpers {
    function processBurnConsentCommit(
        bytes32 stateRoot,
        bytes memory txs,
        Types.AccountMerkleProof[] memory accountProofs
    ) public pure returns (bytes32, bool) {
        uint256 length = txs.burnConsent_size();

        bool isTxValid;
        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , isTxValid) = processBurnConsentTx(
                stateRoot,
                txs,
                i,
                accountProofs[i]
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, !isTxValid);
    }

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txs,
        uint256 i
    ) public pure returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _merkle_proof.account;
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
        Types.UserAccount memory account = _fromAccountProof.account;

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
