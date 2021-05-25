// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";

contract TestTx {
    using Tx for bytes;

    function transferSerialize(Tx.Transfer[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function create2transferSerialize(Tx.Create2Transfer[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transferHasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.transferHasExcessData();
    }

    function create2transferHasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.create2TransferHasExcessData();
    }

    function transferSize(bytes memory txs) public pure returns (uint256) {
        return txs.transferSize();
    }

    function create2transferSize(bytes memory txs)
        public
        pure
        returns (uint256)
    {
        return txs.create2TransferSize();
    }

    function transferDecode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.Transfer memory)
    {
        return Tx.transferDecode(txs, index);
    }

    function create2TransferDecode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.Create2Transfer memory)
    {
        return Tx.create2TransferDecode(txs, index);
    }

    function transferMessageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce
    ) public pure returns (bytes memory) {
        return Tx.transferMessageOf(Tx.transferDecode(txs, index), nonce);
    }

    function create2TransferMessageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce,
        bytes32 to
    ) public pure returns (bytes memory) {
        return
            Tx.create2TransferMessageOf(
                Tx.create2TransferDecode(txs, index),
                nonce,
                to
            );
    }

    function massMigrationDecode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.MassMigration memory _tx)
    {
        return txs.massMigrationDecode(index);
    }

    function massMigrationSize(bytes memory txs) public pure returns (uint256) {
        return txs.massMigrationSize();
    }

    function testMassMigrationMessageOf(
        Tx.MassMigration memory _tx,
        uint256 nonce,
        uint256 spokeID
    ) public pure returns (bytes memory) {
        return Tx.massMigrationMessageOf(_tx, nonce, spokeID);
    }

    function testEncodeDecimal(uint256 amount) external pure returns (uint256) {
        return Tx.encodeDecimal(amount);
    }
}
