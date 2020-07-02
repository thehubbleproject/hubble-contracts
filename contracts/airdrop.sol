pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {FraudProof} from "./FraudProof.sol";
import {Types} from "./libs/Types.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";

contract Airdrop is FraudProof {
    /**
     * @notice Overrides processTx in FraudProof
     */
    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.Transaction memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            uint256,
            bool
        )
    {
        if (_tx.amount <= 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had amount less than 0
            return (ZERO_BYTES32, "", "", ERR_TOKEN_AMT_INVAILD, false);
        }

        bytes32 newRoot;
        Types.UserAccount memory new_to_account;

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(newRoot, accountProofs.to);

        // account holds the token type in the tx
        if (accountProofs.to.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, "", "", ERR_FROM_TOKEN_TYPE, false);

        (new_to_account, newRoot) = ApplyTx(accountProofs.to, _tx);

        return (
            newRoot,
            "",
            RollupUtils.BytesFromAccount(new_to_account),
            0,
            true
        );
    }
}
