pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Types} from "../libs/Types.sol";

interface IFraudProof {
    function processTx(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.Transaction calldata _tx,
        Types.PDAMerkleProof calldata _from_pda_proof,
        Types.AccountMerkleProof calldata _from_merkle_proof,
        Types.AccountMerkleProof calldata _to_merkle_proof
    )
    external
    view
    returns (
        bytes32,
        uint256,
        uint256,
        bool
    );

    function processBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        Types.Transaction[] calldata _txs,
        Types.AccountMerkleProof[] calldata _from_proofs,
        Types.PDAMerkleProof[] calldata  _pda_proof,
        Types.AccountMerkleProof[] calldata _to_proofs
    ) external view returns (bytes32, bool);
}
