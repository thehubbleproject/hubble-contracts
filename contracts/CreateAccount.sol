pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { Governance } from "./Governance.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";

contract CreateAccount is FraudProofHelpers {
    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        governance = Governance(
            nameRegistry.getContractDetails(ParamManager.Governance())
        );
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
    }

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
    )
        public
        view
        returns (
            bytes32,
            bytes32,
            bool
        )
    {
        uint256 length = txs.create_size();

        bytes32 actualTxRoot = merkleUtils.getMerkleRootFromLeaves(
            txs.create_toLeafs()
        );
        if (expectedTxRoot != ZERO_BYTES32) {
            require(
                actualTxRoot == expectedTxRoot,
                "Invalid dispute, tx root doesn't match"
            );
        }

        bool isTxValid;
        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , isTxValid) = processCreateAccountTx(
                stateRoot,
                accountsRoot,
                txs,
                i,
                batchProofs.accountProofs[i].to
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, actualTxRoot, !isTxValid);
    }

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txs,
        uint256 i
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
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
            !merkleUtils.verifyLeaf(
                _balanceRoot,
                merkleUtils.defaultHashes(0), // Zero account leaf
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
