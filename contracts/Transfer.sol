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

contract Transfer is FraudProofHelpers {
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
    function processTransferBatch(
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
        uint256 length = txs.transfer_size();
        bytes32 actualTxRoot = merkleUtils.getMerkleRootFromLeaves(
            txs.transfer_toLeafs()
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
            (stateRoot, , , , isTxValid) = processTx(
                stateRoot,
                accountsRoot,
                txs,
                i,
                batchProofs.pdaProof[i],
                batchProofs.accountProofs[i]
            );

            if (!isTxValid) {
                break;
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
        bytes memory txs,
        uint256 i,
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
            accountProofs.from.accountIP.account.ID
        );

        // STEP:2 Ensure the transaction has been signed using the from public key

        if (
            !txs.transfer_verify(
                i,
                accountProofs.from.accountIP.account.nonce + 1,
                RollupUtils.calculateAddress(
                    _from_pda_proof._pda.pubkey_leaf.pubkey
                )
            )
        ) {
            return (bytes32(0x00), "", "", Types.ErrorCode.BadSignature, false);
        }

        // Validate the from account merkle proof
        ValidateAccountMP(_balanceRoot, accountProofs.from);

        Types.ErrorCode err_code = validateTxBasic(
            txs.transfer_amountOf(i),
            accountProofs.from.accountIP.account
        );
        if (err_code != Types.ErrorCode.NoError)
            return (ZERO_BYTES32, "", "", err_code, false);

        if (
            accountProofs.from.accountIP.account.tokenType !=
            accountProofs.to.accountIP.account.tokenType
        )
            return (
                ZERO_BYTES32,
                "",
                "",
                Types.ErrorCode.BadFromTokenType,
                false
            );

        bytes32 newRoot;
        bytes memory new_from_account;
        bytes memory new_to_account;

        (new_from_account, newRoot) = ApplyTx(accountProofs.from, txs, i);

        // validate if leaf exists in the updated balance tree
        ValidateAccountMP(newRoot, accountProofs.to);

        (new_to_account, newRoot) = ApplyTx(accountProofs.to, txs, i);

        return (
            newRoot,
            new_from_account,
            new_to_account,
            Types.ErrorCode.NoError,
            true
        );
    }
}
