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

    function create2transfer_serialize(Tx.Create2Transfer[] memory txs)
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

    function create2transfer_hasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.create2Transfer_hasExcessData();
    }

    function transfer_size(bytes memory txs) public pure returns (uint256) {
        return txs.transfer_size();
    }

    function create2transfer_size(bytes memory txs)
        public
        pure
        returns (uint256)
    {
        return txs.create2Transfer_size();
    }

    function transfer_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.Transfer memory)
    {
        return Tx.transfer_decode(txs, index);
    }

    function create2Transfer_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.Create2Transfer memory)
    {
        return Tx.create2Transfer_decode(txs, index);
    }

    function transfer_messageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce
    ) public pure returns (bytes memory) {
        return Tx.transfer_messageOf(Tx.transfer_decode(txs, index), nonce);
    }

    function create2Transfer_messageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce,
        uint256[4] memory from,
        uint256[4] memory to
    ) public pure returns (bytes memory) {
        return
            Tx.create2Transfer_messageOf(
                Tx.create2Transfer_decode(txs, index),
                nonce,
                from,
                to
            );
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

    function testMassMigration_messageOf(
        Tx.MassMigration memory _tx,
        uint256 nonce,
        uint256 spokeID
    ) public pure returns (bytes memory) {
        return Tx.massMigration_messageOf(_tx, nonce, spokeID);
    }
}
