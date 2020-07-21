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

import { Tx } from "./libs/Tx.sol";

contract Transfer is FraudProofHelpers {
    using Tx for bytes;

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

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.TransferTransitionProof[] memory proofs
    ) public view returns (bytes32, uint256) {
        uint256 batchSize = txs.transfer_size();
        require(batchSize > 0, "Rollup: empty batch");
        require(!txs.transfer_hasExcessData(), "Rollup: excess tx data");
        bytes32 acc = stateRoot;
        for (uint256 i = 0; i < batchSize; i++) {
            (
                uint256 receiverID,
                uint256 senderID,
                uint256 amount,
                uint256 nonce
            ) = txs.transfer_decode(i);
            uint256 fraudCode = 0;
            (acc, fraudCode) = processTx(
                acc,
                senderID,
                receiverID,
                amount,
                nonce,
                proofs[i]
            );
            if (0 != fraudCode) {
                return (bytes32(0x00), fraudCode);
            }
        }
        return (stateRoot, 0);
    }

    function processTx(
        bytes32 stateRoot,
        uint256 senderID,
        uint256 receiverID,
        uint256 amount,
        uint256 nonce,
        Types.TransferTransitionProof memory proof
    ) public view returns (bytes32, uint256) {
        bytes32 acc = stateRoot;

        // A. check sender inclusion in state
        ValidateAccountMP(
            acc,
            senderID,
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
        if (account.balance < amount) {
            // insufficient funds
            return (bytes32(0x00), 2);
        }
        account.balance -= amount;
        if (account.nonce != nonce) {
            // bad nonce
            return (bytes32(0x00), 3);
        }
        account.nonce += 1;
        if (account.nonce == 0x100000000) {
            // nonce overflows
            return (bytes32(0x00), 4);
        }
        acc = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(account)),
            senderID,
            proof.senderWitness
        );
        uint256 token = account.tokenType;
        // C. check receiver inclusion in state
        account = proof.receiverAccount;
        ValidateAccountMP(
            acc,
            receiverID,
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
        // B. apply diff for receiver
        if (account.tokenType != token) {
            // token type mismatch
            return (bytes32(0x00), 6);
        }
        account.balance += amount;
        if (account.balance >= 0x100000000) {
            // balance overflows
            return (bytes32(0x00), 7);
        }
        acc = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(account)),
            receiverID,
            proof.receiverWitness
        );
        return (acc, 0);
    }
}
