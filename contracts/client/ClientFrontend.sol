pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";

contract ClientFrontend {
    using Tx for bytes;
    using Types for Types.UserState;

    function TransferCommitmentToHash(
        Types.TransferCommitment memory commitment
    ) public pure returns (bytes32) {
        return Types.toHash(commitment);
    }

    function MMCommitmentToHash(Types.MassMigrationCommitment memory commitment)
        public
        pure
        returns (bytes32)
    {
        return Types.toHash(commitment);
    }

    function StateFromBytes(bytes memory stateBytes)
        public
        pure
        returns (Types.UserState memory state)
    {
        (state.pubkeyIndex, state.tokenType, state.balance, state.nonce) = abi
            .decode(stateBytes, (uint256, uint256, uint256, uint256));
    }

    function BytesFromState(Types.UserState memory state)
        public
        pure
        returns (bytes memory)
    {
        return state.encode();
    }

    function HashFromState(Types.UserState memory state)
        public
        pure
        returns (bytes32)
    {
        return keccak256(state.encode());
    }

    function GetGenesisLeaves() public pure returns (bytes32[2] memory leaves) {
        Types.UserState memory state1;
        state1.pubkeyIndex = 0;
        Types.UserState memory state2;
        state2.pubkeyIndex = 1;
        leaves[0] = keccak256(state1.encode());
        leaves[1] = keccak256(state2.encode());
    }

}
