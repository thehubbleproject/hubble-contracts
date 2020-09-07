pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract BurnExecution is FraudProofHelpers {
    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processBurnExecutionBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.AccountMerkleProof[] memory accountProofs
    ) public view returns (bytes32, bool) {
        uint256 length = txs.burnExecution_size();

        bool isTxValid;

        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , isTxValid) = processBurnExecutionTx(
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

    function ApplyBurnExecutionTx(
        Types.AccountMerkleProof memory _fromAccountProof
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _fromAccountProof.account;
        account.balance -= account.burn;
        account.lastBurn = RollupUtils.GetYearMonth();
        updatedAccount = RollupUtils.BytesFromAccount(account);
        newRoot = UpdateAccountWithSiblings(account, _fromAccountProof);
        return (updatedAccount, newRoot);
    }

    /**
     * @notice Overrides processTx in FraudProof
     */
    function processBurnExecutionTx(
        bytes32 _balanceRoot,
        bytes memory txs,
        uint256 i,
        Types.AccountMerkleProof memory _fromAccountProof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        Types.UserAccount memory account = _fromAccountProof.account;
        // FIX:
        // if (txs.burnExecution_fromIndexOf(i) != account.ID) {
        //     return (ZERO_BYTES32, "", Types.ErrorCode.BadFromIndex, false);
        // }
        if (account.balance < account.burn) {
            return (
                ZERO_BYTES32,
                "",
                Types.ErrorCode.NotEnoughTokenBalance,
                false
            );
        }

        uint256 yearMonth = RollupUtils.GetYearMonth();
        if (account.lastBurn == yearMonth) {
            return (
                ZERO_BYTES32,
                "",
                Types.ErrorCode.BurnAlreadyExecuted,
                false
            );
        }

        bytes32 newRoot;
        bytes memory new_from_account;
        (new_from_account, newRoot) = ApplyBurnExecutionTx(_fromAccountProof);

        return (newRoot, new_from_account, Types.ErrorCode.NoError, true);
    }
}
