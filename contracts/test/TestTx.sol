pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Tx} from "../libs/Tx.sol";

contract TestTx {
    using Tx for bytes;

    function transfer_serialize(Tx.Transfer[] calldata txs)
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

    function transfer_decode(bytes calldata txs, uint256 index)
        external
        pure
        returns (Tx.Transfer memory)
    {
        return Tx.transfer_decode(txs, index);
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

    function airdrop_serialize(
        Tx.DropSender calldata stx,
        Tx.DropReceiver[] calldata rtxs
    ) external pure returns (bytes memory) {
        return Tx.serialize(stx, rtxs);
    }

    function airdrop_hasExcessData(bytes calldata txs)
        external
        pure
        returns (bool)
    {
        txs.airdrop_hasExcessData();
    }

    function airdrop_size(bytes calldata txs) external pure returns (uint256) {
        return txs.airdrop_size();
    }

    function airdrop_receiverDecode(bytes calldata txs, uint256 index)
        external
        pure
        returns (Tx.DropReceiver memory)
    {
        return txs.airdrop_receiverDecode(index);
    }

    function airdrop_senderDecode(bytes calldata txs)
        external
        pure
        returns (Tx.DropSender memory)
    {
        return txs.airdrop_senderDecode();
    }

    function airdrop_receiverOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.airdrop_receiverOf(index);
    }

    function airdrop_amountOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.airdrop_amountOf(index);
    }

    function airdrop_senderAccountID(bytes calldata txs)
        external
        pure
        returns (uint256 senderAccountID)
    {
        return txs.airdrop_senderAccountID();
    }

    function airdrop_senderStateID(bytes calldata txs)
        external
        pure
        returns (uint256 receiver)
    {
        return txs.airdrop_senderStateID();
    }

    function airdrop_nonce(bytes calldata txs)
        external
        pure
        returns (uint256 nonce)
    {
        return txs.airdrop_nonce();
    }

    // function create_serialize(Tx.CreateDecoded[] calldata txs)
    //     external
    //     pure
    //     returns (bytes memory)
    // {
    //     return Tx.serialize(txs);
    // }

    // function create_hasExcessData(bytes calldata txs)
    //     external
    //     pure
    //     returns (bool)
    // {
    //     return txs.create_hasExcessData();
    // }

    // function create_size(bytes calldata txs) external pure returns (uint256) {
    //     return txs.create_size();
    // }

    // function create_accountIdOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.create_accountIdOf(index);
    // }

    // function create_stateIdOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.create_stateIdOf(index);
    // }

    // function create_tokenOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.create_tokenOf(index);
    // }

    // function create_hashOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (bytes32)
    // {
    //     return txs.create_hashOf(index);
    // }

    // function burnConcent_serialize(Tx.BurnConcentDecoded[] calldata txs)
    //     external
    //     pure
    //     returns (bytes memory)
    // {
    //     return Tx.serialize(txs);
    // }

    // function burnConcent_hasExcessData(bytes calldata txs)
    //     external
    //     pure
    //     returns (bool)
    // {
    //     return txs.burnConcent_hasExcessData();
    // }

    // function burnConcent_size(bytes calldata txs)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.burnConcent_size();
    // }

    // function burnConcent_stateIdOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.burnConcent_stateIdOf(index);
    // }

    // function burnConcent_amountOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.burnConcent_amountOf(index);
    // }

    // function burnConcent_nonceOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (uint256)
    // {
    //     return txs.burnConcent_nonceOf(index);
    // }

    // function burnConcent_signOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (bool)
    // {
    //     return txs.burnConcent_signOf(index);
    // }

    // function burnConcent_hashOf(bytes calldata txs, uint256 index)
    //     external
    //     pure
    //     returns (bytes32)
    // {
    //     return txs.burnConcent_hashOf(index);
    // }

    // function burnConcent_mapToPoint(bytes calldata txs, uint256 index)
    //     external
    //     view
    //     returns (uint256[2] memory)
    // {
    //     return txs.burnConcent_mapToPoint(index);
    // }
}
