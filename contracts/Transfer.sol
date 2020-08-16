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
import { BLS } from "./libs/BLS.sol";
import { Tx } from "./libs/Tx.sol";

contract Transfer is FraudProofHelpers {
    // BLS PROOF VALIDITY IMPL START

    using Tx for bytes;

    uint256 constant STATE_WITNESS_LENGTH = 32;
    uint256 constant PUBKEY_WITNESS_LENGTH = 32;

    struct InvalidSignatureProof {
        Types.UserAccount[] stateAccounts;
        bytes32[STATE_WITNESS_LENGTH][] stateWitnesses;
        uint256[4][] pubkeys;
        bytes32[PUBKEY_WITNESS_LENGTH][] pubkeyWitnesses;
    }

    function checkStateInclusion(
        bytes32 root,
        uint256 stateIndex,
        bytes32 stateAccountHash,
        bytes32[STATE_WITNESS_LENGTH] memory witness
    ) internal pure returns (bool) {
        bytes32 acc = stateAccountHash;
        uint256 path = stateIndex;
        for (uint256 i = 0; i < STATE_WITNESS_LENGTH; i++) {
            if (path & 1 == 1) {
                acc = keccak256(abi.encode(witness[i], acc));
            } else {
                acc = keccak256(abi.encode(acc, witness[i]));
            }
            path >>= 1;
        }
        return root == acc;
    }

    function checkPubkeyInclusion(
        bytes32 root,
        uint256 pubkeyIndex,
        bytes32 pubkeyHash,
        bytes32[STATE_WITNESS_LENGTH] memory witness
    ) internal pure returns (bool) {
        bytes32 acc = pubkeyHash;
        uint256 path = pubkeyIndex;
        for (uint256 i = 0; i < STATE_WITNESS_LENGTH; i++) {
            if (path & 1 == 1) {
                acc = keccak256(abi.encode(witness[i], acc));
            } else {
                acc = keccak256(abi.encode(acc, witness[i]));
            }
            path >>= 1;
        }
        return root == acc;
    }

    uint256 constant MASK_4BYTES = 0xffffffff;
    uint256 constant MASK_1BYTES = 0xff;
    uint256 constant OFF_TX_TYPE = 64;
    uint256 constant OFF_NONCE = 65;
    uint256 constant OFF_TX_DATA = 69;
    uint256 constant MSG_LEN_0 = 49;
    uint256 constant TX_LEN_0 = 12;

    function _checkSignature(
        uint256[2] memory signature,
        InvalidSignatureProof memory proof,
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 appID,
        bytes memory txs
    ) internal view returns (Types.ErrorCode) {
        uint256 batchSize = txs.transfer_size();
        uint256[2][] memory messages = new uint256[2][](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 signerStateID;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                signerStateID := and(
                    mload(add(add(txs, mul(i, TX_LEN_0)), 4)),
                    MASK_4BYTES
                )
            }

            // check state inclustion
            require(
                checkStateInclusion(
                    stateRoot,
                    signerStateID,
                    RollupUtils.HashFromAccount(proof.stateAccounts[i]),
                    proof.stateWitnesses[i]
                ),
                "Rollup: state inclusion signer"
            );

            // check pubkey inclusion
            uint256 signerAccountID = proof.stateAccounts[i].ID;
            require(
                checkPubkeyInclusion(
                    accountRoot,
                    signerAccountID,
                    keccak256(abi.encodePacked(proof.pubkeys[i])),
                    proof.pubkeyWitnesses[i]
                ),
                "Rollup: account does not exists"
            );

            // construct the message
            signerAccountID = signerAccountID <<= 224;
            require(proof.stateAccounts[i].nonce > 0, "Rollup: zero nonce");
            uint256 nonce = proof.stateAccounts[i].nonce <<= 224;
            bytes memory txMsg = new bytes(MSG_LEN_0);

            // solium-disable-next-line security/no-inline-assembly
            assembly {
                mstore(add(txMsg, 32), appID)
                mstore8(add(txMsg, OFF_TX_TYPE), 1)
                mstore(add(txMsg, OFF_NONCE), sub(nonce, 1))
                mstore(
                    add(txMsg, OFF_TX_DATA),
                    mload(add(add(txs, 32), mul(TX_LEN_0, i)))
                )
            }
            // make the message
            messages[i] = BLS.mapToPoint(keccak256(abi.encodePacked(txMsg)));
        }
        if (!BLS.verifyMultiple(signature, proof.pubkeys, messages)) {
            return Types.ErrorCode.BadSignature;
        }
        return Types.ErrorCode.NoError;
    }

    // BLS PROOF VALIDITY IMPL END

    // /*********************
    //  * Constructor *
    //  ********************/
    // constructor(address _registryAddr) public {
    //     nameRegistry = Registry(_registryAddr);

    //     governance = Governance(
    //         nameRegistry.getContractDetails(ParamManager.Governance())
    //     );

    //     merkleUtils = MTUtils(
    //         nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
    //     );

    //     tokenRegistry = ITokenRegistry(
    //         nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
    //     );
    // }

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
        bytes32 expectedTxHashCommitment
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

        bytes32 actualTxHashCommitment = keccak256(abi.encode(txs));
        if (expectedTxHashCommitment != ZERO_BYTES32) {
            require(
                actualTxHashCommitment == expectedTxHashCommitment,
                "Invalid dispute, tx root doesn't match"
            );
        }

        bool isTxValid;

        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , , isTxValid) = processTx(
                stateRoot,
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
