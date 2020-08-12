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

contract BurnConsent is FraudProofHelpers {
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

    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processBurnConsentBatch(
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
        uint256 length = txs.burnConsent_size();
        bytes32 actualTxRoot = merkleUtils.getMerkleRootFromLeaves(
            txs.burnConsent_toLeafs()
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
            (stateRoot, , , isTxValid) = processBurnConsentTx(
                stateRoot,
                accountsRoot,
                txs,
                i,
                batchProofs.pdaProof[i],
                batchProofs.accountProofs[i].from
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, actualTxRoot, !isTxValid);
    }

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txs,
        uint256 i
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
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
        bytes32 _accountsRoot,
        bytes memory txs,
        uint256 i,
        Types.PDAMerkleProof memory _from_pda_proof,
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
        // Step-1 Prove that from address's public keys are available
        ValidatePubkeyAvailability(
            _accountsRoot,
            _from_pda_proof,
            _fromAccountProof.accountIP.account.ID
        );

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
