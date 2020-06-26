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

    bytes32 public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;
    Governance public governance;

    /********************
     * Error Codes *
    ********************/
    uint public constant NO_ERR = 0;
    uint public constant ERR_TOKEN_ADDR_INVAILD = 1;  // account doesnt hold token type in the tx
    uint public constant ERR_TOKEN_AMT_INVAILD = 2; // tx amount is less than zero
    uint public constant ERR_TOKEN_NOT_ENOUGH_BAL = 3; // leaf doesnt has enough balance
    uint public constant ERR_FROM_TOKEN_TYPE = 4; // from account doesnt hold the token type in the tx
    uint public constant ERR_TO_TOKEN_TYPE = 5; // to account doesnt hold the token type in the tx

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
    ) public view returns(uint) {
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
        return(
            RollupUtils.UpdateBalanceInAccount(
                account,
                RollupUtils.BalanceFromAccount(account).sub(numOfTokens)
            )
        );
    }

    function AddTokensToAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return(
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
    ) public view returns(bytes32, uint) {
        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(new_account)),
            _merkle_proof.accountIP.pathToAccount,
            _merkle_proof.siblings
        );
        uint balance = RollupUtils.BalanceFromAccount(new_account);
        return (newRoot, balance);
    }

    function ValidateSignature(
        Types.Transaction memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof
    ) public pure returns(bool) {
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
        Types.AccountMerkleProof memory _from_merkle_proof,
        Types.AccountMerkleProof memory _to_merkle_proof
    )
        public
        view
        returns (
            bytes32,
            uint256,
            uint256,
            bool
        )
    {
        // Step-1 Prove that from address's public keys are available
        ValidatePubkeyAvailability(_accountsRoot, _from_pda_proof, _tx.fromIndex);

        // STEP:2 Ensure the transaction has been signed using the from public key
        // ValidateSignature(_tx, _from_pda_proof);

        // Validate the from account merkle proof
        ValidateAccountMP(_balanceRoot, _from_merkle_proof);

        (uint err_code) = validateTxBasic(_tx,
                                          _from_merkle_proof.accountIP.account);
        if(err_code != NO_ERR) return (ZERO_BYTES32, 0, err_code, false);

        Types.UserAccount memory new_from_account = RemoveTokensFromAccount(
            _from_merkle_proof.accountIP.account,
            _tx.amount
        );

        // account holds the token type in the tx
        if (_from_merkle_proof.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, ERR_FROM_TOKEN_TYPE, false);

        (bytes32 newFromRoot, uint from_new_balance) = UpdateAccountWithSiblings(
            new_from_account,
            _from_merkle_proof
        );

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(newFromRoot, _to_merkle_proof);

        Types.UserAccount memory new_to_account = AddTokensToAccount(
            _to_merkle_proof.accountIP.account,
            _tx.amount
        );

        // account holds the token type in the tx
        if (_to_merkle_proof.accountIP.account.tokenType != _tx.tokenType)
            // invalid state transition

            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, 0, ERR_FROM_TOKEN_TYPE, false);

        (bytes32 newToRoot, uint to_new_balance) = UpdateAccountWithSiblings(
            new_to_account,
            _to_merkle_proof
        );

        return (
            newToRoot,
            from_new_balance,
            to_new_balance,
            true
        );
    }
}