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
                // call process tx update for every transaction to check if any
                // tx evaluates correctly
                (stateRoot, , , , isTxValid) = processTx(
                    stateRoot,
                    accountsRoot,
                    _txs[i],
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
        bytes memory _tx_raw,
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
        Types.BurnConsent memory _tx = RollupUtils.DecompressConsent(_tx_raw);
        // Step-1 Prove that from address's public keys are available
        ValidatePubkeyAvailability(
            _accountsRoot,
            _from_pda_proof,
            _tx.fromIndex
        );

        // STEP:2 Ensure the transaction has been signed using the from public key
        // ValidateSignature(_tx, _from_pda_proof);

        // Validate the from account merkle proof
        ValidateAccountMP(_balanceRoot, accountProofs.from);

        // Validate only certain token is allow to burn

        uint256 err_code = _validateTxBasic(
            _tx.amount,
            accountProofs.from.accountIP.account
        );
        if (err_code != NO_ERR) return (ZERO_BYTES32, "", "", err_code, false);

        bytes32 newRoot;
        bytes memory new_from_account;

        (new_from_account, newRoot) = _ApplyTx(
            accountProofs.from,
            _tx.fromIndex,
            0,
            _tx.amount
        );

        return (newRoot, new_from_account, "", 0, true);
    }
}
