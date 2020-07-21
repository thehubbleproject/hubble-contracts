pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";

contract TestTx {
    using Tx for bytes;

    function transfer_serialize(Tx.TransferDecoded[] calldata txs)
        external
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transfer_hasExcessData(bytes calldata txs)
        external
        pure
        returns (bool)
    {
        return txs.transfer_hasExcessData();
    }

    function transfer_size(bytes calldata txs) external pure returns (uint256) {
        return txs.transfer_size();
    }

    function transfer_amountOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_amountOf(index);
    }

    function transfer_senderOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_senderOf(index);
    }

    function transfer_receiverOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_receiverOf(index);
    }

    function transfer_hashOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (bytes32)
    {
        return txs.transfer_hashOf(index);
    }

    function transfer_mapToPoint(bytes calldata txs, uint256 index)
        external
        view
        returns (uint256[2] memory)
    {
        return txs.transfer_mapToPoint(index);
    }
}
