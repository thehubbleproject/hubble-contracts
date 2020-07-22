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
        bytes calldata txs,
        bytes32 txCommit
    ) external view returns (uint256) {
        uint256 senderAccountID = txs.airdrop_senderAccountID();
        if (
            !accountRegistry.exists(
                senderAccountID,
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

    function processAirdropBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.AirDropTransitionProof memory senderProof,
        Types.AirDropTransitionProof[] memory receiverProofs
    ) public view returns (bytes32, uint256) {
        uint256 batchSize = txs.airdrop_size();
        require(batchSize > 0, "Rollup: empty batch");
        require(!txs.airdrop_hasExcessData(), "Rollup: excess tx data");
        bytes32 acc = stateRoot;
        uint256 airdropAmount = 0;
        uint256 token = senderProof.account.tokenType;
        for (uint256 i = 0; i < batchSize - 1; i++) {
            (uint256 receiverID, uint256 amount) = txs.airdrop_decode(i);
            uint256 fraudCode = 0;
            airdropAmount += amount;
            (acc, fraudCode) = processAirdropTxReceiverSide(
                acc,
                receiverID,
                amount,
                token,
                receiverProofs[i]
            );
            if (0 != fraudCode) {
                return (bytes32(0x00), fraudCode);
            }
        }
        uint256 fraudCode;
        (acc, fraudCode) = processAirdropTxSenderSide(
            acc,
            txs.airdrop_senderAccountID(),
            txs.airdrop_senderStateID(),
            airdropAmount,
            txs.airdrop_nonce(),
            senderProof
        );
        if (0 != fraudCode) {
            return (bytes32(0x00), fraudCode);
        }
        return (acc, 0);
    }

    function processAirdropTxReceiverSide(
        bytes32 stateRoot,
        uint256 receiverID,
        uint256 amount,
        uint256 token,
        Types.AirDropTransitionProof memory proof
    ) public view returns (bytes32, uint256) {
        // A. check receiver inclusion in state
        Types.UserAccount memory account = proof.account;
        ValidateAccountMP(stateRoot, receiverID, account, proof.witness);
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.account.isEmptyAccount()) {
        //   return bytes32(0x00), 1;
        // }
        //
        //
        // B. apply diff for receiver
        if (account.tokenType != token) {
            // token type mismatch
            return (bytes32(0x00), 2);
        }
        account.balance += amount;
        if (account.balance >= 0x100000000) {
            // balance overflows
            return (bytes32(0x00), 3);
        }
        return (
            merkleUtils.updateLeafWithSiblings(
                keccak256(RollupUtils.BytesFromAccount(account)),
                receiverID,
                proof.witness
            ),
            0
        );
    }

    function processAirdropTxSenderSide(
        bytes32 stateRoot,
        uint256 senderAccountID,
        uint256 senderStateID,
        uint256 amount,
        uint256 nonce,
        Types.AirDropTransitionProof memory proof
    ) public view returns (bytes32, uint256) {
        // A. check sender inclusion in state
        Types.UserAccount memory account = proof.account;
        ValidateAccountMP(stateRoot, senderStateID, account, proof.witness);

        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.senderAccounts.isEmptyAccount()) {
        //   return bytes32(0x00), 4;
        // }
        //
        //
        // B. check account ID
        if (senderAccountID != account.ID) {
            // account id mismatch
            return (bytes32(0x00), 5);
        }
        // C. apply diff for sender
        if (account.balance < amount) {
            // insufficient funds
            return (bytes32(0x00), 6);
        }
        account.balance -= amount;
        if (account.nonce != nonce) {
            // bad nonce
            return (bytes32(0x00), 7);
        }
        account.nonce += 1;
        if (account.nonce == 0x100000000) {
            // nonce overflows
            return (bytes32(0x00), 8);
        }
        return (
            merkleUtils.updateLeafWithSiblings(
                keccak256(RollupUtils.BytesFromAccount(account)),
                senderStateID,
                proof.witness
            ),
            0
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
