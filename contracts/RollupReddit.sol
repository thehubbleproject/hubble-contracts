pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { IReddit } from "./interfaces/IReddit.sol";
import { Transfer } from "./Transfer.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Types } from "./libs/Types.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { Tx } from "./libs/Tx.sol";
import { MassMigration } from "./MassMigrations.sol";

contract RollupReddit {
    using Tx for bytes;
    Transfer public transfer;

    function checkTransferSignature(
        bytes32 appID,
        uint256[2] memory signature,
        bytes32 stateRoot,
        bytes32 accountRoot,
        Types.SignatureProof memory proof,
        bytes memory txs
    ) public view returns (Types.ErrorCode) {
        transfer.checkSignature(
            signature,
            proof,
            stateRoot,
            accountRoot,
            appID,
            txs
        );
    }

    Registry public nameRegistry;
    MassMigration public massMigs;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        transfer = Transfer(
            nameRegistry.getContractDetails(ParamManager.TRANSFER())
        );
        massMigs = MassMigration(
            nameRegistry.getContractDetails(ParamManager.MASS_MIGS())
        );
    }

    //
    // Transfer
    //

    function ApplyTransferTx(
        Types.AccountMerkleProof memory _merkle_proof,
        bytes memory txBytes,
        bool isSender
    ) public view returns (bytes memory, bytes32 newRoot) {
        (Tx.Transfer memory _tx, ) = txBytes.transfer_fromEncoded();
        if (isSender) {
            return transfer.ApplyTransferTxSender(_merkle_proof, _tx);
        } else {
            return transfer.ApplyTransferTxReceiver(_merkle_proof, _tx);
        }
    }

    function processTransferTx(
        bytes32 _balanceRoot,
        bytes memory sig,
        bytes memory txBytes,
        Types.AccountMerkleProof memory fromAccountProof,
        Types.AccountMerkleProof memory toAccountProof
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
        (Tx.Transfer memory _tx, uint256 tokenType) = txBytes
            .transfer_fromEncoded();
        // Validate BLS sig
        return
            transfer.processTx(
                _balanceRoot,
                _tx,
                tokenType,
                fromAccountProof,
                toAccountProof
            );
    }

    function processCommit(
        bytes32 initialStateRoot,
        bytes memory txs,
        Types.AccountMerkleProof[] memory accountProofs,
        uint256 tokenType,
        uint256 feeReceiver,
        Types.Usage batchType
    ) public view returns (bytes32, bool) {
        return
            transfer.processTransferCommit(
                initialStateRoot,
                txs,
                accountProofs,
                tokenType,
                feeReceiver
            );
    }

    function processMassMigrationCommit(
        Types.MMCommitment memory commitment,
        Types.AccountMerkleProof[] memory accountProofs
    ) public view returns (bytes32, bool) {
        // call mass mig contract
        return massMigs.processMassMigrationCommit(commitment, accountProofs);
    }
}
