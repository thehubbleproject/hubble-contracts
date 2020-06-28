pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Types} from "../libs/Types.sol";

interface IAirdrop {
    function processDrop(
        uint256 tokenType,
        Types.Airdrop calldata drop,
        Types.AccountMerkleProof calldata _to_merkle_proof
    )
        external
        view
        returns (
            bytes32,
            uint256,
            bool
        );

    function disputeAirdrop(
        uint256 _batch_id,
        Types.Airdrop[] calldata drops,
        Types.AccountMerkleProof[] calldata _to_proofs
    ) external;
}
