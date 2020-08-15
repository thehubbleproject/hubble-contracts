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

    uint256 constant MASK_4BYTES = 0xffffffff;
    uint256 constant MASK_1BYTES = 0xff;
    uint256 constant MASK_TX_0 = 0xffffffffffffffffffffffffffffffff;

    uint256 constant TX_LEN_0 = 12;
    uint256 constant MSG_LEN_0 = 49;

    uint256 constant POSITION_SENDER_0 = 4;
    uint256 constant POSITION_RECEIVER_0 = 8;
    uint256 constant POSITION_AMOUNT_0 = 12;

    uint256 constant OFF_TX_TYPE = 64;
    uint256 constant OFF_NONCE = 65;
    uint256 constant OFF_TX_DATA = 69;

    struct TransferSignatureProof {
        Types.UserAccount[] stateAccounts;
        bytes32[STATE_WITNESS_LENGTH][] stateWitnesses;
        uint256[4][] pubkeys;
        bytes32[PUBKEY_WITNESS_LENGTH][] pubkeyWitnesses;
    }

    struct AccountsProof {
        AccountMerkleProof from;
        AccountMerkleProof to;
    }

    struct AccountMerkleProof {
        Types.UserAccount account;
        bytes32[] witness;
    }

    function checkInclusion(
        bytes32 root,
        uint256 index,
        bytes32 leaf,
        bytes32[] memory witness
    ) internal pure returns (bool) {
        bytes32 acc = leaf;
        uint256 path = index;
        for (uint256 i = 0; i < witness.length; i++) {
            if (path & 1 == 1) {
                acc = keccak256(abi.encode(witness[i], acc));
            } else {
                acc = keccak256(abi.encode(acc, witness[i]));
            }
            path >>= 1;
        }
        return root == acc;
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

    function _checkSignature(
        uint256[2] memory signature,
        TransferSignatureProof memory proof,
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

    function generateTxRoot(bytes memory txs)
        public
        view
        returns (bytes32 txRoot)
    {
        uint256 n = txs.length / TX_LEN_0;
        bytes32[] memory buf = new bytes32[](n);
        uint256 offBuf = 32;
        uint256 offTx = 32;
        for (uint256 i = 0; i < n; i++) {
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                mstore(add(offBuf, buf), keccak256(add(offTx, txs), TX_LEN_0))
            }
            offBuf += 32;
            offTx += TX_LEN_0;
        }
        n >>= 1;
        while (true) {
            if (n == 0) {
                break;
            }
            for (uint256 j = 0; j < n; j++) {
                uint256 k = j << 1;
                buf[j] = keccak256(abi.encode(buf[k], buf[k + 1]));
            }
            n >>= 1;
        }
        return buf[0];
    }

    function _processTransferCommitment(
        bytes32 stateRoot,
        bytes memory txs,
        AccountsProof[] memory proof
    ) internal view returns (bytes32, bool) {
        uint256 commitmentSize = txs.length / TX_LEN_0;

        bool isTxValid;
        for (uint256 i = 0; i < commitmentSize; i++) {
            (stateRoot, , , , isTxValid) = _processTx(
                stateRoot,
                txs,
                i,
                proof[i]
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, isTxValid);
    }

    function _processTx(
        bytes32 stateRoot,
        bytes memory txs,
        uint256 i,
        AccountsProof memory proof
    )
        internal
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        uint256 stateIndex = txs.transfer_fromIndexOf(i);
        require(
            checkInclusion(
                stateRoot,
                stateIndex,
                RollupUtils.HashFromAccount(proof.from.account),
                proof.from.witness
            ),
            "Rollup: state inclusion sender"
        );
        if (proof.from.account.tokenType != proof.to.account.tokenType)
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
        uint256 amount = txs.transfer_amountOf(i);
        if (proof.from.account.balance < amount)
            return (
                ZERO_BYTES32,
                "",
                "",
                Types.ErrorCode.NotEnoughTokenBalance,
                false
            );
        (new_from_account, newRoot) = ApplyTransferSender(
            proof.from,
            stateIndex,
            amount
        );

        stateIndex = txs.transfer_toIndexOf(i);
        require(
            checkInclusion(
                newRoot,
                stateIndex,
                RollupUtils.HashFromAccount(proof.to.account),
                proof.to.witness
            ),
            "Rollup: state inclusion receiver"
        );
        (new_from_account, newRoot) = ApplyTransferReceiver(
            proof.to,
            stateIndex,
            amount
        );
        return (
            newRoot,
            new_from_account,
            new_to_account,
            Types.ErrorCode.NoError,
            true
        );
    }

    function ApplyTransferSender(
        AccountMerkleProof memory proof,
        uint256 fromIndex,
        uint256 amount
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = proof.account;
        account = RemoveTokensFromAccount(account, amount);
        account.nonce++;
        newRoot = UpdateAccountWithSiblings(proof, fromIndex);
        return (RollupUtils.BytesFromAccount(account), newRoot);
    }

    function ApplyTransferReceiver(
        AccountMerkleProof memory proof,
        uint256 toIndex,
        uint256 amount
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = proof.account;
        account = AddTokensToAccount(account, amount);
        newRoot = UpdateAccountWithSiblings(proof, toIndex);
        return (RollupUtils.BytesFromAccount(account), newRoot);
    }

    function UpdateAccountWithSiblings(
        AccountMerkleProof memory proof,
        uint256 index
    ) public view returns (bytes32) {
        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(proof.account)),
            index,
            proof.witness
        );
        return (newRoot);
    }
}
