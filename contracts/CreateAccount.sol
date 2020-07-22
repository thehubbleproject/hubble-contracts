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
import { IncrementalTree } from "./IncrementalTree.sol";

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
        uint256[] memory pubkeyIDs = new uint256[](publicKeys.length);
        for (uint256 i = 0; i < publicKeys.length; i++) {
            pubkeyIDs[i] = accountsTree.appendDataBlock(publicKeys[i]);
        }
        return pubkeyIDs;
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

    function processCreateAccountBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        bytes[] memory _txBytes,
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
        Types.CreateAccount[] memory _txs;
        for (uint256 i = 0; i < _txBytes.length; i++) {
            _txs[i] = RollupUtils.CreateAccountFromBytes(_txBytes[i]);
        }

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
                (stateRoot, , , isTxValid) = processCreateAccountTx(
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

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof memory _merkle_proof,
        Types.CreateAccount memory _tx
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account;
        account.ID = _tx.toIndex;
        account.tokenType = _tx.tokenType;
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
        Types.CreateAccount memory _tx,
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
        // Assuming Reddit have run createPublickeys
        ValidatePubkeyAvailability(_accountsRoot, _to_pda_proof, _tx.toIndex);

        // Validate Signture, this requires validate public key and it's existence with _from_pda_proof.

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
            _tx
        );

        return (newRoot, createdAccountBytes, Types.ErrorCode.NoError, true);
    }
}
