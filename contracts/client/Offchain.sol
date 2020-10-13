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

    function decodeTransfer(bytes memory txBytes)
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
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256)
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

    function decodeMassMigration(bytes memory txBytes)
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
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256)
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

    function decodeCreate2Transfer(bytes memory txBytes)
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
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
    }
}
