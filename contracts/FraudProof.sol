pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {IERC20} from "./interfaces/IERC20.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";

import {Types} from "./libs/Types.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {ECVerify} from "./libs/ECVerify.sol";

import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {Governance} from "./Governance.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";

contract FraudProofSetup {
    using SafeMath for uint256;
    using ECVerify for bytes32;

    MTUtils public merkleUtils;
    ITokenRegistry public tokenRegistry;
    Registry public nameRegistry;

    bytes32
        public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    Governance public governance;

    /********************
     * Error Codes *
     ********************/
    uint256 public constant NO_ERR = 0;
    uint256 public constant ERR_TOKEN_ADDR_INVAILD = 1; // account doesnt hold token type in the tx
    uint256 public constant ERR_TOKEN_AMT_INVAILD = 2; // tx amount is less than zero
    uint256 public constant ERR_TOKEN_NOT_ENOUGH_BAL = 3; // leaf doesnt has enough balance
    uint256 public constant ERR_FROM_TOKEN_TYPE = 4; // from account doesnt hold the token type in the tx
    uint256 public constant ERR_TO_TOKEN_TYPE = 5; // to account doesnt hold the token type in the tx
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
            "From PDA proof is incorrect"
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
        bytes32 accountLeaf = RollupUtils.getAccountHash(
            merkle_proof.accountIP.account.ID,
            merkle_proof.accountIP.account.balance,
            merkle_proof.accountIP.account.nonce,
            merkle_proof.accountIP.account.tokenType
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

    function validateTxBasic(
        Types.Transaction memory _tx,
        Types.UserAccount memory _from_account
    ) public view returns (uint256) {
        // verify that tokens are registered
        if (tokenRegistry.registeredTokens(_tx.tokenType) == address(0)) {
            // invalid state transition
            // to be slashed because the submitted transaction
            // had invalid token type
            return ERR_TOKEN_ADDR_INVAILD;
        }

        if (_tx.amount == 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had 0 amount.
            return ERR_TOKEN_AMT_INVAILD;
        }

        // check from leaf has enough balance
        if (_from_account.balance < _tx.amount) {
            // invalid state transition
            // needs to be slashed because the account doesnt have enough balance
            // for the transfer
            return ERR_TOKEN_NOT_ENOUGH_BAL;
        }

        return NO_ERR;
    }

    function RemoveTokensFromAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return (
            RollupUtils.UpdateBalanceInAccount(
                account,
                RollupUtils.BalanceFromAccount(account).sub(numOfTokens)
            )
        );
    }

    /**
     * @notice ApplyTx applies the transaction on the account. This is where
     * people need to define the logic for the application
     * @param _merkle_proof contains the siblings and path to the account
     * @param transaction is the transaction that needs to be applied
     * @return returns updated account and updated state root
     * */
    function ApplyTx(
        Types.AccountMerkleProof memory _merkle_proof,
        Types.Transaction memory transaction
    )
        public
        view
        returns (Types.UserAccount memory updatedAccount, bytes32 newRoot)
    {
        Types.UserAccount memory account = _merkle_proof.accountIP.account;
        if (transaction.fromIndex == account.ID) {
            account = RemoveTokensFromAccount(account, transaction.amount);
            account.nonce++;
        }

        if (transaction.toIndex == account.ID) {
            account = AddTokensToAccount(account, transaction.amount);
        }

        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);

        return (account, newRoot);
    }

    function AddTokensToAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return (
            RollupUtils.UpdateBalanceInAccount(
                account,
                RollupUtils.BalanceFromAccount(account).add(numOfTokens)
            )
        );
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
                    .getTxHash(
                    _tx
                        .fromIndex,
                    _tx
                        .toIndex,
                    _tx
                        .tokenType,
                    _tx
                        .amount
                )
                    .ecrecovery(_tx.signature),
            "Signature is incorrect"
        );
    }
}

contract FraudProof is FraudProofHelpers {
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

    function generateTxRoot(Types.Transaction[] memory _txs)
        public
        view
        returns (bytes32 txRoot)
    {
        // generate merkle tree from the txs provided by user
        bytes[] memory txs = new bytes[](_txs.length);
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = RollupUtils.CompressTx(_txs[i]);
        }
        txRoot = merkleUtils.getMerkleRoot(txs);
        return txRoot;
    }

    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        Types.Transaction[] memory _txs,
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
     * @notice processTx processes a transactions and returns the updated balance tree
     *  and the updated leaves
     * conditions in require mean that the dispute be declared invalid
     * if conditons evaluate if the coordinator was at fault
     * @return Total number of batches submitted onchain
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

        uint256 err_code = validateTxBasic(
            _tx,
            accountProofs.from.accountIP.account
        );
        if (err_code != NO_ERR) return (ZERO_BYTES32, "", "", err_code, false);

        // account holds the token type in the tx
        if (accountProofs.from.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, "", "", ERR_FROM_TOKEN_TYPE, false);

        bytes32 newRoot;
        Types.UserAccount memory new_from_account;
        Types.UserAccount memory new_to_account;

        (new_from_account, newRoot) = ApplyTx(accountProofs.from, _tx);

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
            RollupUtils.BytesFromAccount(new_from_account),
            RollupUtils.BytesFromAccount(new_to_account),
            0,
            true
        );
    }
}
