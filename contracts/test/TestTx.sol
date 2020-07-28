pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";

contract TestTx {
    using Tx for bytes;

    function transfer_serialize(Tx.Transfer[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transfer_serializeFromEncodedBytes(bytes[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
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

    function transfer_hashOf(bytes memory txs, uint256 index)
        public
        pure
        returns (bytes32)
    {
        return txs.transfer_hashOf(index);
    }

    function transfer_amountOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_amountOf(index);
    }

    function transfer_fromIndexOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_fromIndexOf(index);
    }

    function transfer_toIndexOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_toIndexOf(index);
    }

    function transfer_signatureOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (bytes memory)
    {
        return txs.transfer_signatureOf(index);
    }
}
