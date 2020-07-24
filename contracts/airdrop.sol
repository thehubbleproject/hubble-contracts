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

import {BLSAccountRegistry} from "./BLSAccountRegistry.sol";
import {BLS} from "./libs/BLS.sol";
import {Tx} from "./libs/Tx.sol";

contract Airdrop is FraudProofHelpers {
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

    //     tokenRegistry = ITokenRegistry(
    //         nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
    //     );
    // }

    // TODO: consider whether we need tx root for airdrops
    // function generateTxRoot(Types.DropTx[] memory _txs)
    //     public
    //     view
    //     returns (bytes32 txRoot)
    // {
    //     // generate merkle tree from the txs provided by user
    //     bytes[] memory txs = new bytes[](_txs.length);
    //     for (uint256 i = 0; i < _txs.length; i++) {
    //         txs[i] = RollupUtils.CompressAirdrop(_txs[i]);
    //     }
    //     txRoot = merkleUtils.getMerkleRoot(txs);
    //     return txRoot;
    // }

    function signatureCheck(
        uint256[2] calldata signature,
        Types.PubkeyAccountProof calldata proof,
        uint256 signerAccountID,
        bytes32 txCommit
    ) external view returns (uint256) {
        if (
            !accountRegistry.exists(
                signerAccountID,
                proof.pubkey,
                proof.witness
            )
        ) {
            return 1;
        }
        uint256[2] memory message = BLS.mapToPoint(txCommit);
        if (!BLS.verifySingle(signature, proof.pubkey, message)) {
            return 2;
        }
        return 0;
    }

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.AirdropTransitionSenderProof memory senderProof,
        Types.AirdropTransitionReceiverProof[] memory receiverProofs
    ) public view returns (bytes32, Types.ErrorCode) {
        uint256 batchSize = txs.airdrop_size();
        Tx.DropSender memory stx = txs.airdrop_senderDecode();
        Types.ErrorCode err = processTxSenderPre(stateRoot, stx, senderProof);
        bytes32 acc = stateRoot;
        uint256 airdropAmount = 0;
        uint256 token = senderProof.account.tokenType;
        for (uint256 i = 0; i < batchSize; i++) {
            Tx.DropReceiver memory _tx = txs.airdrop_receiverDecode(i);
            airdropAmount += _tx.amount;
            (acc, , err) = processTxReceiver(
                acc,
                token,
                _tx,
                receiverProofs[i]
            );
            if (Types.ErrorCode.NoError != err) {
                return (bytes32(0x00), err);
            }
        }
        (acc, , err) = processTxSenderPost(
            acc,
            airdropAmount,
            stx,
            senderProof
        );
        if (Types.ErrorCode.NoError != err) {
            return (bytes32(0x00), err);
        }
        return (acc, Types.ErrorCode.NoError);
    }

    function processTxReceiver(
        bytes32 stateRoot,
        uint256 tokenType,
        Tx.DropReceiver memory _tx,
        Types.AirdropTransitionReceiverProof memory proof
    )
        public
        view
        returns (
            bytes32,
            bytes memory updatedReceiver,
            Types.ErrorCode
        )
    {
        // A. check receiver inclusion in state
        Types.UserAccount memory account = proof.account;
        ValidateAccountMP(stateRoot, _tx.receiverID, account, proof.witness);
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.account.isEmptyAccount()) {
        //   return err
        // }
        //
        //
        // B. apply diff for receiver
        if (account.tokenType != tokenType) {
            // token type mismatch
            return (bytes32(0x00), "", Types.ErrorCode.TokenMismatch);
        }
        account.balance += _tx.amount;
        if (account.balance >= 0x100000000) {
            // balance overflows
            return (bytes32(0x00), "", Types.ErrorCode.Overflow);
        }
        updatedReceiver = RollupUtils.BytesFromAccount(account);
        return (
            merkleUtils.updateLeafWithSiblings(
                keccak256(RollupUtils.BytesFromAccount(account)),
                _tx.receiverID,
                proof.witness
            ),
            updatedReceiver,
            Types.ErrorCode.NoError
        );
    }

    function processTxSenderPre(
        bytes32 stateRoot,
        Tx.DropSender memory _tx,
        Types.AirdropTransitionSenderProof memory proof
    ) public view returns (Types.ErrorCode) {
        // A. check sender inclusion in state
        Types.UserAccount memory account = proof.account;
        ValidateAccountMP(stateRoot, _tx.stateID, account, proof.preWitness);
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.senderAccounts.isEmptyAccount()) {
        //   return err
        // }
        //
        //
        if (_tx.accountID != account.ID) {
            return Types.ErrorCode.BadAccountID;
        }
        return Types.ErrorCode.NoError;
    }

    function processTxSenderPost(
        bytes32 stateRoot,
        uint256 amount,
        Tx.DropSender memory _tx,
        Types.AirdropTransitionSenderProof memory proof
    )
        public
        view
        returns (
            bytes32,
            bytes memory updatedSender,
            Types.ErrorCode
        )
    {
        // A. check sender inclusion in state
        Types.UserAccount memory account = proof.account;
        ValidateAccountMP(stateRoot, _tx.stateID, account, proof.postWitness);
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.senderAccounts.isEmptyAccount()) {
        //   return err
        // }
        //
        //
        //
        // B. apply diff for sender
        if (account.balance < amount) {
            return (bytes32(0x00), "", Types.ErrorCode.NotEnoughTokenBalance);
        }
        account.balance -= amount;
        if (account.nonce != _tx.nonce) {
            return (bytes32(0x00), "", Types.ErrorCode.BadNonce);
        }
        account.nonce += 1;
        if (account.nonce == 0x100000000) {
            // nonce overflows
            return (bytes32(0x00), "", Types.ErrorCode.Overflow);
        }
        updatedSender = RollupUtils.BytesFromAccount(account);
        return (
            merkleUtils.updateLeafWithSiblings(
                keccak256(updatedSender),
                _tx.stateID,
                proof.postWitness
            ),
            updatedSender,
            Types.ErrorCode.NoError
        );
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
