pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import {FraudProofHelpers} from "./FraudProof.sol";
import {Types} from "./libs/Types.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {Governance} from "./Governance.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {ParamManager} from "./libs/ParamManager.sol";

import {BLSAccountRegistry} from "./BLSAccountRegistry.sol";
import {BLS} from "./libs/BLS.sol";
import {Tx} from "./libs/Tx.sol";

contract Transfer is FraudProofHelpers {
    using Tx for bytes;

    BLSAccountRegistry accountRegistry;

    // FIX: commented out to test other components
    // constructor(address _registryAddr) public {
    //     nameRegistry = Registry(_registryAddr);

    //     governance = Governance(
    //         nameRegistry.getContractDetails(ParamManager.Governance())
    //     );

    //     merkleUtils = MTUtils(
    //         nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
    //     );
    // }

    function generateTxRoot(Tx.Transfer[] memory _txs)
        public
        view
        returns (bytes32 txRoot)
    {
        return
            merkleUtils.ascendToRootTruncated(Tx.transfer_decodedToLeafs(_txs));
    }

    function generateTxRoot(bytes memory txs)
        public
        view
        returns (bytes32 txRoot)
    {
        return merkleUtils.ascendToRootTruncated(txs.transfer_toLeafs());
    }

    // TODO: move somewhere nice
    uint256 constant ACCOUNT_ID_LEN = 4;
    uint256 constant MASK_ACCOUNT_ID = 0xffffffff;

    function txRootCheck(bytes32 txRoot, bytes calldata txs)
        external
        view
        returns (uint256)
    {
        if (txRoot != generateTxRoot(txs)) {
            return 1;
        }
        return 0;
    }

    function signerAccountCheck(
        Types.SignerProof calldata proof,
        bytes32 state,
        bytes calldata signers,
        bytes calldata txs
    ) external view returns (uint256) {
        uint256 batchSize = txs.transfer_size();
        // Checks below has to be done at submit batch level
        // require(batchSize > 0, "Rollup: empty signer array");
        // require(!txs.transfer_hasExcessData(), "Transfer: excess tx data");
        uint256 targetIndex = proof.targetIndex;
        require(targetIndex < batchSize, "Transfer: invalid target index");
        uint256 stateID = txs.transfer_senderOf(targetIndex);
        ValidateAccountMP(state, stateID, proof.account, proof.witness);
        uint256 committedSignerAccountID;
        bytes memory _signers = signers;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // TODO: use calldata copy
            let p_signers := add(
                _signers,
                mul(add(1, targetIndex), ACCOUNT_ID_LEN)
            )
            committedSignerAccountID := and(mload(p_signers), MASK_ACCOUNT_ID)
        }
        if (committedSignerAccountID != proof.account.ID) {
            return 1;
        }
        return 0;
    }

    function signatureCheck(
        uint256[2] calldata signature,
        Types.PubkeyAccountProofs calldata proof,
        bytes calldata txs,
        bytes calldata signers
    ) external view returns (uint256) {
        uint256 batchSize = txs.transfer_size();
        // Checks below has to be done at submit batch level
        // require(batchSize > 0, "Transfer: empty batch");
        // require(!txs.transfer_hasExcessData(), "Transfer: excess tx data");
        uint256[2][] memory messages = new uint256[2][](batchSize);
        // TODO use calldata copy
        bytes memory _signers = signers;
        uint256 off = ACCOUNT_ID_LEN;
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 signerID;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                let p_signers := add(_signers, off)
                signerID := and(mload(p_signers), MASK_ACCOUNT_ID)
            }
            require(
                accountRegistry.exists(
                    signerID,
                    proof.pubkeys[i],
                    proof.witnesses[i]
                ),
                "Transfer: account does not exists"
            );
            messages[i] = txs.transfer_mapToPoint(i);
            off += ACCOUNT_ID_LEN;
        }
        if (!BLS.verifyMultiple(signature, proof.pubkeys, messages)) {
            return 1;
        }
        return 0;
    }

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.TransferTransitionProof[] memory proofs
    ) public view returns (bytes32, Types.ErrorCode) {
        uint256 batchSize = txs.transfer_size();
        require(batchSize > 0, "Transfer: empty batch");
        require(!txs.transfer_hasExcessData(), "Transfer: excess tx data");
        bytes32 acc = stateRoot;
        Tx.Transfer memory _tx;
        for (uint256 i = 0; i < batchSize; i++) {
            Types.ErrorCode err;
            _tx = Tx.transfer_decode(txs, i);
            (acc, , , err, ) = processTx(acc, _tx, proofs[i]);
            if (Types.ErrorCode.NoError != err) {
                return (bytes32(0x00), err);
            }
        }
        return (acc, Types.ErrorCode.NoError);
    }

    function processTx(
        bytes32 stateRoot,
        Tx.Transfer memory _tx,
        Types.TransferTransitionProof memory proof
    )
        public
        view
        returns (
            bytes32 acc,
            bytes memory senderUpdated,
            bytes memory receiverUpdated,
            Types.ErrorCode,
            bool
        )
    {
        acc = stateRoot;
        // A. check sender inclusion in state
        ValidateAccountMP(
            acc,
            _tx.senderID,
            proof.senderAccount,
            proof.senderWitness
        );
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.senderAccounts.isEmptyAccount()) {
        //   return bytes32(0x00), 1;
        // }
        //
        //
        // B. apply diff for sender
        Types.UserAccount memory account = proof.senderAccount;
        uint256 amount = _tx.amount;
        if (account.balance < amount) {
            return (
                bytes32(0x00),
                "",
                "",
                Types.ErrorCode.NotEnoughTokenBalance,
                false
            );
        }
        account.balance -= amount;
        if (account.nonce != _tx.nonce) {
            return (bytes32(0x00), "", "", Types.ErrorCode.BadNonce, false);
        }
        account.nonce += 1;
        if (account.nonce == 0x100000000) {
            // nonce overflows
            return (bytes32(0x00), "", "", Types.ErrorCode.Overflow, false);
        }
        receiverUpdated = RollupUtils.BytesFromAccount(account);
        acc = merkleUtils.updateLeafWithSiblings(
            keccak256(receiverUpdated),
            _tx.senderID,
            proof.senderWitness
        );
        uint256 token = account.tokenType;
        // C. check receiver inclusion in state
        account = proof.receiverAccount;
        ValidateAccountMP(
            acc,
            _tx.receiverID,
            proof.receiverAccount,
            proof.receiverWitness
        );
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.receiverAccounts.isEmptyAccount()) {
        //   return bytes32(0x00), 5;
        // }
        //
        //
        // D. apply diff for receiver
        if (account.tokenType != token) {
            return (
                bytes32(0x00),
                "",
                "",
                Types.ErrorCode.TokenMismatch,
                false
            );
        }
        account.balance += amount;
        if (account.balance >= 0x100000000) {
            // balance overflows
            return (bytes32(0x00), "", "", Types.ErrorCode.Overflow, false);
        }
        senderUpdated = RollupUtils.BytesFromAccount(account);
        acc = merkleUtils.updateLeafWithSiblings(
            keccak256(senderUpdated),
            _tx.receiverID,
            proof.receiverWitness
        );
        return (
            acc,
            senderUpdated,
            receiverUpdated,
            Types.ErrorCode.NoError,
            true
        );
    }

    function ApplyTx(
        Tx.Transfer memory _tx,
        Types.TransferTransitionProof memory proof
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _merkle_proof.accountIP.account;
        if (fromIndex == account.ID) {
            account = RemoveTokensFromAccount(account, amount);
            account.nonce++;
        }

        if (toIndex == account.ID) {
            account = AddTokensToAccount(account, amount);
        }

        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);

        return (RollupUtils.BytesFromAccount(account), newRoot);
    }
}
