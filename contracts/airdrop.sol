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

    function generateTxRoot(Types.DropTx[] memory _txs)
        public
        view
        returns (bytes32 txRoot)
    {
        // generate merkle tree from the txs provided by user
        bytes[] memory txs = new bytes[](_txs.length);
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = RollupUtils.CompressAirdrop(_txs[i]);
        }
        txRoot = merkleUtils.getMerkleRoot(txs);
        return txRoot;
    }

    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processAirdropBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        Types.DropTx[] memory _txs,
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
        bytes32 actualTxRoot = generateTxRoot(_txs);
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
                (stateRoot, , , , isTxValid) = processAirdropTx(
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
     * @notice processTx processes a transactions and returns the updated balance tree
     *  and the updated leaves
     * conditions in require mean that the dispute be declared invalid
     * if conditons evaluate if the coordinator was at fault
     * @return Total number of batches submitted onchain
     */
    function processAirdropTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.DropTx memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
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

        Types.ErrorCode err_code = validateAirDropTxBasic(
            _tx,
            accountProofs.from.accountIP.account
        );
        if (err_code != Types.ErrorCode.NoError) return (ZERO_BYTES32, "", "", err_code, false);

        // account holds the token type in the tx
        if (accountProofs.from.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, "", "", Types.ErrorCode.BadFromTokenType, false);

        bytes32 newRoot;
        bytes memory new_from_account;
        bytes memory new_to_account;

        (new_from_account, newRoot) = ApplyAirdropTx(accountProofs.from, _tx);

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(newRoot, accountProofs.to);

        // account holds the token type in the tx
        if (accountProofs.to.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (
                ZERO_BYTES32,
                "",
                "",
                Types.ErrorCode.BadFromTokenType,
                false
            );

        (new_to_account, newRoot) = ApplyAirdropTx(accountProofs.to, _tx);

        return (newRoot, new_from_account, new_to_account, Types.ErrorCode.NoError, true);
    }

    /**
     * @notice ApplyTx applies the transaction on the account. This is where
     * people need to define the logic for the application
     * @param _merkle_proof contains the siblings and path to the account
     * @param transaction is the transaction that needs to be applied
     * @return returns updated account and updated state root
     * */
    function ApplyAirdropTx(
        Types.AccountMerkleProof memory _merkle_proof,
        Types.DropTx memory transaction
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        return
            _ApplyTx(
                _merkle_proof,
                transaction.fromIndex,
                transaction.toIndex,
                transaction.amount
            );
    }

    function validateAirDropTxBasic(
        Types.DropTx memory _tx,
        Types.UserAccount memory _from_account
    ) public view returns (Types.ErrorCode) {
        // verify that tokens are registered
        if (tokenRegistry.registeredTokens(_tx.tokenType) == address(0)) {
            // invalid state transition
            // to be slashed because the submitted transaction
            // had invalid token type
            return Types.ErrorCode.InvalidTokenAddress;
        }

        return _validateTxBasic(_tx.amount, _from_account);
    }
}
