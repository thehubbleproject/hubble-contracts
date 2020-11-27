pragma solidity ^0.5.15;

/**
    @notice types defined here are passing between users and the client, but not on chain.
 */
library Offchain {
    struct Transfer {
        uint256 txType;
        uint256 fromIndex;
        uint256 toIndex;
        uint256 amount;
        uint256 fee;
        uint256 nonce;
    }

    function decodeTransfer(bytes memory encodedTx)
        internal
        pure
        returns (Transfer memory _tx)
    {
        (
            _tx.txType,
            _tx.fromIndex,
            _tx.toIndex,
            _tx.amount,
            _tx.fee,
            _tx.nonce
        ) = abi.decode(
            encodedTx,
            (uint256, uint256, uint256, uint256, uint256, uint256)
        );
    }

    function encodeTransfer(Transfer memory _tx)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.amount,
                _tx.fee,
                _tx.nonce
            );
    }

    struct MassMigration {
        uint256 txType;
        uint256 fromIndex;
        uint256 amount;
        uint256 fee;
        uint256 spokeID;
        uint256 nonce;
    }

    function decodeMassMigration(bytes memory encodedTx)
        internal
        pure
        returns (MassMigration memory _tx)
    {
        (
            _tx.txType,
            _tx.fromIndex,
            _tx.amount,
            _tx.fee,
            _tx.spokeID,
            _tx.nonce
        ) = abi.decode(
            encodedTx,
            (uint256, uint256, uint256, uint256, uint256, uint256)
        );
    }

    function encodeMassMigration(MassMigration memory _tx)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.amount,
                _tx.fee,
                _tx.spokeID,
                _tx.nonce
            );
    }

    struct Create2Transfer {
        uint256 txType;
        uint256 fromIndex;
        uint256 toIndex;
        uint256 toAccID;
        uint256 amount;
        uint256 fee;
        uint256 nonce;
    }

    function decodeCreate2Transfer(bytes memory encodedTx)
        internal
        pure
        returns (Create2Transfer memory _tx)
    {
        (
            _tx.txType,
            _tx.fromIndex,
            _tx.toIndex,
            _tx.toAccID,
            _tx.amount,
            _tx.fee,
            _tx.nonce
        ) = abi.decode(
            encodedTx,
            (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
    }

    function encodeCreate2Transfer(Create2Transfer memory _tx)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.toAccID,
                _tx.amount,
                _tx.fee,
                _tx.nonce
            );
    }

    struct Create2TransferWithPub {
        uint256 txType;
        uint256 fromIndex;
        uint256[4] toPubkey;
        uint256 amount;
        uint256 fee;
        uint256 nonce;
    }

    function decodeCreate2TransferWithPub(bytes memory encodedTx)
        internal
        pure
        returns (Create2TransferWithPub memory _tx)
    {
        (
            _tx.txType,
            _tx.fromIndex,
            _tx.toPubkey,
            _tx.amount,
            _tx.fee,
            _tx.nonce
        ) = abi.decode(
            encodedTx,
            (uint256, uint256, uint256[4], uint256, uint256, uint256)
        );
    }

    function encodeCreate2TransferWithPub(Create2TransferWithPub memory _tx)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.toPubkey,
                _tx.amount,
                _tx.fee,
                _tx.nonce
            );
    }
}
