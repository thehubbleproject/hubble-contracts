pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {FraudProofHelpers} from "./FraudProof.sol";
import {Types} from "./libs/Types.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {Governance} from "./Governance.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {ParamManager} from "./libs/ParamManager.sol";

contract Airdrop is FraudProofHelpers {
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
    function processBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        bytes[] memory _txs,
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
        bytes32 actualTxRoot = merkleUtils.getMerkleRoot(_txs);
        // if there is an expectation set, revert if it's not met
        if (expectedTxRoot == ZERO_BYTES32) {
            // if tx root while submission doesnt match tx root of given txs
            // dispute is unsuccessful
            require(
                actualTxRoot == expectedTxRoot,
                "Invalid dispute, tx root doesn't match"
            );
        }

        bool isTxValid;
        {
            for (uint256 i = 0; i < _txs.length; i++) {
                Types.Drop memory _tx = RollupUtils.DecompressDrop(_txs[i]);
                // call process tx update for every transaction to check if any
                // tx evaluates correctly
                (stateRoot, , , , isTxValid) = processTx(
                    stateRoot,
                    accountsRoot,
                    _tx,
                    batchProofs.pdaProof[i],
                    batchProofs.accountProofs[i]
                );

                if (!isTxValid) {
                    break;
                }
            }
        }
        return (stateRoot, actualTxRoot, !isTxValid);
    }

    /**
     * @notice Overrides processTx in FraudProof
     */
    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.Drop memory _tx,
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

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(_balanceRoot, accountProofs.to);

        // account holds the token type in the tx
        if (accountProofs.to.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, "", "", ERR_FROM_TOKEN_TYPE, false);
        
        Types.UserAccount memory account = accountProofs.to.accountIP.account;
        account = AddTokensToAccount(account, _tx.amount);
        bytes32 newRoot = UpdateAccountWithSiblings(account, accountProofs.to);
        bytes memory new_to_account = RollupUtils.BytesFromAccount(account);

        return (newRoot, "", new_to_account, 0, true);
    }
}
