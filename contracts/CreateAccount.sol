pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";

contract CreateAccount is FraudProofHelpers {
    ITokenRegistry public tokenRegistry;

    modifier onlyReddit() {
        // TODO: Add only Reddit check
        _;
    }

    function processCreateAccountBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        bytes memory txs,
        Types.BatchValidationProofs memory batchProofs,
        bytes32 expectedTxRoot
    ) public view returns (bytes32, bool) {
        uint256 length = txs.create_size();

        bool isTxValid;
        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , isTxValid) = processCreateAccountTx(
                stateRoot,
                accountsRoot,
                txs,
                i,
                batchProofs.pdaProof[i],
                batchProofs.accountProofs[i].to
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, !isTxValid);
    }

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txs,
        uint256 i
    ) public pure returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account;
        account.ID = txs.create_accountIdOf(i);
        account.tokenType = txs.create_tokenOf(i);
        account.balance = 0;
        account.nonce = 0;
        account.burn = 0;
        account.lastBurn = 0;

        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);
        updatedAccount = RollupUtils.BytesFromAccount(account);
        return (updatedAccount, newRoot);
    }

    function processCreateAccountTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        bytes memory txs,
        uint256 i,
        Types.PDAMerkleProof memory _to_pda_proof,
        Types.AccountMerkleProof memory to_account_proof
    )
        public
        view
        returns (
            bytes32 newRoot,
            bytes memory createdAccountBytes,
            Types.ErrorCode,
            bool
        )
    {
        if (
            to_account_proof.accountIP.pathToAccount != txs.create_stateIdOf(i)
        ) {
            return ("", "", Types.ErrorCode.NotOnDesignatedStateLeaf, false);
        }
        if (
            tokenRegistry.registeredTokens(txs.create_tokenOf(i)) == address(0)
        ) {
            return ("", "", Types.ErrorCode.InvalidTokenAddress, false);
        }

        // Validate we are creating on a zero account
        if (
            !MerkleTreeUtilsLib.verifyLeaf(
                _balanceRoot,
                keccak256(abi.encode(0)), // Zero account leaf
                to_account_proof.accountIP.pathToAccount,
                to_account_proof.siblings
            )
        ) {
            return ("", "", Types.ErrorCode.NotCreatingOnZeroAccount, false);
        }

        (createdAccountBytes, newRoot) = ApplyCreateAccountTx(
            to_account_proof,
            txs,
            i
        );

        return (newRoot, createdAccountBytes, Types.ErrorCode.NoError, true);
    }
}
