pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Types} from "../libs/Types.sol";

interface IReddit {
        function processAirdropTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.DropTx calldata _tx,
        Types.PDAMerkleProof calldata _from_pda_proof,
        Types.AccountProofs calldata accountProofs
    )
       external 
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            uint256,
            bool
        );

    function processTxBurnConsent(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnConsent calldata _tx,
        Types.PDAMerkleProof calldata _from_pda_proof,
        Types.AccountProofs calldata accountProofs
    )
        external
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            uint256,
            bool
        );

    function processTxBurnExecution(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnExecution calldata _tx,
        Types.PDAMerkleProof calldata _from_pda_proof,
        Types.AccountProofs calldata accountProofs
    )
        external
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            uint256,
            bool
        );

    function processBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes[] calldata _txs,
        Types.BatchValidationProofs calldata batchProofs,
        bytes32 expectedTxRoot
    )
        external
        view
        returns (
            bytes32,
            bytes32,
            bool
        );
}
