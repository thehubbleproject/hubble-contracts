pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Tx } from "./libs/Tx.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";

import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { ECVerify } from "./libs/ECVerify.sol";

import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { Governance } from "./Governance.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";

contract FraudProofSetup {
    using SafeMath for uint256;
    using ECVerify for bytes32;
    using Tx for bytes;

    MTUtils public merkleUtils;
    ITokenRegistry public tokenRegistry;
    Registry public nameRegistry;

    bytes32
        public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    Governance public governance;
}

contract FraudProofHelpers is FraudProofSetup {
    function ValidatePubkeyAvailability(
        bytes32 _accountsRoot,
        Types.PDAMerkleProof memory _from_pda_proof,
        uint256 from_index
    ) public view {
        // verify from account pubkey exists in PDA tree
        // NOTE: We dont need to prove that to address has the pubkey available
        Types.PDALeaf memory fromPDA = Types.PDALeaf({
            pubkey: _from_pda_proof._pda.pubkey_leaf.pubkey
        });

        require(
            merkleUtils.verifyLeaf(
                _accountsRoot,
                RollupUtils.PDALeafToHash(fromPDA),
                _from_pda_proof._pda.pathToPubkey,
                _from_pda_proof.siblings
            ),
            "PDA proof is incorrect"
        );

        // convert pubkey path to ID
        uint256 computedID = merkleUtils.pathToIndex(
            _from_pda_proof._pda.pathToPubkey,
            governance.MAX_DEPTH()
        );

        // make sure the ID in transaction is the same account for which account proof was provided
        require(
            computedID == from_index,
            "Pubkey not related to the from account in the transaction"
        );
    }

    function ValidateAccountMP(
        bytes32 root,
        Types.AccountMerkleProof memory merkle_proof
    ) public view {
        bytes32 accountLeaf = RollupUtils.HashFromAccount(
            merkle_proof.accountIP.account
        );

        // verify from leaf exists in the balance tree
        require(
            merkleUtils.verifyLeaf(
                root,
                accountLeaf,
                merkle_proof.accountIP.pathToAccount,
                merkle_proof.siblings
            ),
            "Merkle Proof is incorrect"
        );
    }

    function _validateTxBasic(
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

    function validateTxBasic(
        bytes memory txs,
        uint256 i,
        Types.UserAccount memory _from_account
    ) public pure returns (Types.ErrorCode) {
        if (txs.transfer_nonceOf(i) != _from_account.nonce.add(1)) {
            return Types.ErrorCode.BadNonce;
        }

        return _validateTxBasic(txs.transfer_amountOf(i), _from_account);
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
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
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
                txs.transfer_senderOf(i),
                txs.transfer_receiverOf(i),
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
    ) public view returns (bytes32) {
        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(new_account)),
            _merkle_proof.accountIP.pathToAccount,
            _merkle_proof.siblings
        );
        return (newRoot);
    }

    function ValidateSignature(
        Types.Transaction memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof
    ) public pure returns (bool) {
        require(
            RollupUtils.calculateAddress(
                _from_pda_proof._pda.pubkey_leaf.pubkey
            ) ==
                RollupUtils
                    .getTxSignBytes(
                    _tx
                        .fromIndex,
                    _tx
                        .toIndex,
                    _tx
                        .tokenType,
                    _tx
                        .txType,
                    _tx
                        .nonce,
                    _tx
                        .amount
                )
                    .ecrecovery(_tx.signature),
            "Signature is incorrect"
        );
    }
}
