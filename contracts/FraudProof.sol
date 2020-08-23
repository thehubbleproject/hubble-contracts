pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Tx } from "./libs/Tx.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ParamManager } from "./libs/ParamManager.sol";

import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { Governance } from "./Governance.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";

contract FraudProofSetup {
    using SafeMath for uint256;
    using Tx for bytes;
    Registry public nameRegistry;

    bytes32
        public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    Governance public governance;
}

contract FraudProofHelpers is FraudProofSetup {
    function ValidateAccountMP(
        bytes32 root,
        Types.AccountMerkleProof memory merkle_proof
    ) public pure {
        bytes32 accountLeaf = RollupUtils.HashFromAccount(
            merkle_proof.accountIP.account
        );

        // verify from leaf exists in the balance tree
        require(
            MerkleTreeUtilsLib.verifyLeaf(
                root,
                accountLeaf,
                merkle_proof.accountIP.pathToAccount,
                merkle_proof.siblings
            ),
            "Merkle Proof is incorrect"
        );
    }

    function validateTxBasic(
        uint256 amount,
        Types.UserAccount memory _from_account
    ) public pure returns (Types.ErrorCode) {
        if (amount == 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had 0 amount.
            return Types.ErrorCode.InvalidTokenAmount;
        }

        // check from leaf has enough balance
        if (_from_account.balance < amount) {
            // invalid state transition
            // needs to be slashed because the account doesnt have enough balance
            // for the transfer
            return Types.ErrorCode.NotEnoughTokenBalance;
        }

        return Types.ErrorCode.NoError;
    }

    function RemoveTokensFromAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return (
            UpdateBalanceInAccount(
                account,
                BalanceFromAccount(account).sub(numOfTokens)
            )
        );
    }

    // returns a new User Account with updated balance
    function UpdateBalanceInAccount(
        Types.UserAccount memory original_account,
        uint256 new_balance
    ) public pure returns (Types.UserAccount memory updated_account) {
        original_account.balance = new_balance;
        return original_account;
    }

    function _ApplyTx(
        Types.AccountMerkleProof memory _merkle_proof,
        uint256 fromIndex,
        uint256 toIndex,
        uint256 amount
    ) public pure returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _merkle_proof.accountIP.account;
        if (fromIndex == account.ID) {
            account = RemoveTokensFromAccount(account, amount);
            account.nonce++;
        }

        if (toIndex == account.ID) {
            account = AddTokensToAccount(account, amount);
        }

        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);

        return (RollupUtils.BytesFromAccount(account), newRoot);
    }

    function ApplyTx(
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

    function AddTokensToAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return (
            UpdateBalanceInAccount(
                account,
                BalanceFromAccount(account).add(numOfTokens)
            )
        );
    }

    function BalanceFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (uint256)
    {
        return account.balance;
    }

    /**
     * @notice Returns the updated root and balance
     */
    function UpdateAccountWithSiblings(
        Types.UserAccount memory new_account,
        Types.AccountMerkleProof memory _merkle_proof
    ) public pure returns (bytes32) {
        bytes32 newRoot = MerkleTreeUtilsLib.rootFromWitnesses(
            keccak256(RollupUtils.BytesFromAccount(new_account)),
            _merkle_proof.accountIP.pathToAccount,
            _merkle_proof.siblings
        );
        return newRoot;
    }
}
