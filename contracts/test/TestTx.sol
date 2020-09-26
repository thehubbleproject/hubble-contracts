pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";

contract TestTx {
    using Tx for bytes;

    function transfer_serialize(Tx.Transfer[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transfer_serializeFromEncoded(bytes[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transfer_bytesFromEncoded(Types.Transfer memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                Types.Usage.Transfer,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.nonce,
                _tx.amount,
                _tx.fee
            );
    }

    function transfer_hasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.transfer_hasExcessData();
    }

    function transfer_size(bytes memory txs) public pure returns (uint256) {
        return txs.transfer_size();
    }

    function transfer_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.Transfer memory)
    {
        return Tx.transfer_decode(txs, index);
    }

    function transfer_messageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce
    ) public pure returns (bytes memory) {
        return Tx.transfer_messageOf(Tx.transfer_decode(txs, index), nonce);
    }

    function massMigration_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.MassMigration memory _tx)
    {
        return txs.massMigration_decode(index);
    }

    function massMigration_size(bytes memory txs)
        public
        pure
        returns (uint256)
    {
        return txs.massMigration_size();
    }
}
