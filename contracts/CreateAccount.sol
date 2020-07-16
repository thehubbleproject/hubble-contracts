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
import {IncrementalTree} from "./IncrementalTree.sol";

contract CreateAccount is FraudProofHelpers {
    IncrementalTree public accountsTree;

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
        accountsTree = IncrementalTree(
            nameRegistry.getContractDetails(ParamManager.ACCOUNTS_TREE())
        );
    }

    modifier onlyReddit() {
        // TODO: Add only Reddit check
        _;
    }

    function createPublickeys(bytes[] memory publicKeys)
        public
        onlyReddit
        returns (uint256[] memory)
    {
        uint256[] memory accountIDs = new uint256[](publicKeys.length);
        for (uint256 i = 0; i < publicKeys.length; i++) {
            Types.PDALeaf memory newPDALeaf;
            newPDALeaf.pubkey = publicKeys[i];
            accountIDs[i] = accountsTree.appendLeaf(
                RollupUtils.PDALeafToHash(newPDALeaf)
            );
        }
        return accountIDs;
    }

    function generateTxRoot(Types.CreateAccount[] memory _txs)
        public
        view
        returns (bytes32 txRoot)
    {
        // generate merkle tree from the txs provided by user
        bytes[] memory txs = new bytes[](_txs.length);
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = RollupUtils.CompressCreateAccount(_txs[i]);
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
        Types.CreateAccount[] memory _txs,
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
                    batchProofs.accountProofs[i].to
                );

                if (!isTxValid) {
                    break;
                }
            }
        }
        return (stateRoot, actualTxRoot, !isTxValid);
    }

    function ValidateZeroAccount(Types.UserAccount memory account)
        public
        pure
        returns (bool)
    {
        return
            account.ID == 0 &&
            account.tokenType == 0 &&
            account.balance == 0 &&
            account.nonce == 0;
    }

    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.CreateAccount memory _tx,
        Types.PDAMerkleProof memory _to_pda_proof,
        Types.AccountMerkleProof memory to_account_proof
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
        Types.UserAccount memory createdAccount;
        createdAccount.ID = _tx.toIndex;
        createdAccount.tokenType = 1; // Arbitrary assign a default token
        createdAccount.balance = 0;
        createdAccount.nonce = 0;

        // Assuming Reddit have run rollup.sol::createPublickeys
        ValidatePubkeyAvailability(_accountsRoot, _to_pda_proof, _tx.toIndex);

        // to_account_proof.accountIP.account should to be a zero account
        bool result = ValidateZeroAccount(to_account_proof.accountIP.account);
        if (result == false) {
            return ("", "", "", 0, false);
        }

        ValidateAccountMP(_balanceRoot, to_account_proof);

        bytes32 newRoot = UpdateAccountWithSiblings(
            createdAccount,
            to_account_proof // We only use the pathToAccount and siblings but not the proof itself
        );
        bytes memory createdAccountBytes = RollupUtils.BytesFromAccount(
            createdAccount
        );

        return (newRoot, createdAccountBytes, "", 0, true);
    }
}
