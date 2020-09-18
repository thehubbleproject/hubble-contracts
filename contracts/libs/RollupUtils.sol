pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "./Tx.sol";
import { Types } from "./Types.sol";

library RollupUtils {
    using Tx for bytes;

    function CommitmentToHash(
        bytes32 stateRoot,
        bytes32 accountRoot,
        uint256[2] memory signature,
        bytes memory txs,
        uint256 tokenType,
        uint256 feeReceiver,
        // Typechain can't parse enum for library.
        // See https://github.com/ethereum-ts/TypeChain/issues/216
        uint8 batchType
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    stateRoot,
                    accountRoot,
                    signature,
                    txs,
                    tokenType,
                    feeReceiver,
                    batchType
                )
            );
    }

    function MMCommitmentToHash(
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes memory txs,
        uint256 tokenID,
        uint256 amount,
        bytes32 withdrawRoot,
        uint256 targetSpokeID,
        uint256[2] memory aggregatedSignature
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    stateRoot,
                    accountRoot,
                    txs,
                    tokenID,
                    amount,
                    withdrawRoot,
                    targetSpokeID,
                    aggregatedSignature,
                    Types.Usage.MassMigration
                )
            );
    }

    // ---------- Account Related Utils -------------------

    // AccountFromBytes decodes the bytes to account
    function AccountFromBytes(bytes memory accountBytes)
        internal
        pure
        returns (
            uint256 ID,
            uint256 balance,
            uint256 nonce,
            uint256 tokenType,
            uint256 burn,
            uint256 lastBurn
        )
    {
        return
            abi.decode(
                accountBytes,
                (uint256, uint256, uint256, uint256, uint256, uint256)
            );
    }

    //
    // BytesFromAccount and BytesFromAccountDeconstructed do the same thing i.e encode account to bytes
    //
    function BytesFromAccount(Types.UserAccount memory account)
        internal
        pure
        returns (bytes memory data)
    {
        data = abi.encodePacked(
            account.ID,
            account.balance,
            account.nonce,
            account.tokenType,
            account.burn,
            account.lastBurn
        );

        return data;
    }

    function HashFromAccount(Types.UserAccount memory account)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromAccount(account));
    }

    /**
     * @notice Calculates the address from the pubkey
     * @param pub is the pubkey
     * @return Returns the address that has been calculated from the pubkey
     */
    function calculateAddress(bytes memory pub)
        internal
        pure
        returns (address addr)
    {
        bytes32 hash = keccak256(pub);
        assembly {
            mstore(0, hash)
            addr := mload(0)
        }
    }

    function GetGenesisLeaves()
        internal
        pure
        returns (bytes32[2] memory leaves)
    {
        Types.UserAccount memory account1 = Types.UserAccount({
            ID: 0,
            tokenType: 0,
            balance: 0,
            nonce: 0,
            burn: 0,
            lastBurn: 0
        });
        Types.UserAccount memory account2 = Types.UserAccount({
            ID: 1,
            tokenType: 0,
            balance: 0,
            nonce: 0,
            burn: 0,
            lastBurn: 0
        });
        leaves[0] = HashFromAccount(account1);
        leaves[1] = HashFromAccount(account2);
    }

    function GetGenesisDataBlocks()
        internal
        pure
        returns (bytes[2] memory dataBlocks)
    {
        Types.UserAccount memory account1 = Types.UserAccount({
            ID: 0,
            tokenType: 0,
            balance: 0,
            nonce: 0,
            burn: 0,
            lastBurn: 0
        });
        Types.UserAccount memory account2 = Types.UserAccount({
            ID: 1,
            tokenType: 0,
            balance: 0,
            nonce: 0,
            burn: 0,
            lastBurn: 0
        });
        dataBlocks[0] = BytesFromAccount(account1);
        dataBlocks[1] = BytesFromAccount(account2);
    }

    // ---------- Tx Related Utils -------------------

    function ToBytes(Types.Transfer memory _tx)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.nonce,
                _tx.amount,
                _tx.fee
            );
    }

    function ToBytes(Types.MassMigration memory _tx)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.spokeID,
                _tx.tokenType,
                _tx.nonce,
                _tx.amount,
                _tx.fee
            );
    }

    function FromBytesToTransfer(bytes memory txBytes)
        internal
        pure
        returns (Types.Transfer memory)
    {
        // TODO: use txBytes.transfer_transfer_encodedFromBytes(...)
        Types.Transfer memory transaction;
        (
            transaction.txType,
            transaction.fromIndex,
            transaction.toIndex,
            transaction.tokenType,
            transaction.nonce,
            transaction.amount,
            transaction.fee
        ) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        return transaction;
    }

    function FromBytesToMassMigration(bytes memory txBytes)
        internal
        pure
        returns (Types.MassMigration memory transaction)
    {
        (
            transaction.txType,
            transaction.fromIndex,
            transaction.toIndex,
            transaction.spokeID,
            transaction.tokenType,
            transaction.nonce,
            transaction.amount,
            transaction.fee
        ) = abi.decode(
            txBytes,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            )
        );
        return transaction;
    }

    function getTxSignBytes(Types.Transfer memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    _tx.txType,
                    _tx.fromIndex,
                    _tx.toIndex,
                    _tx.nonce,
                    _tx.amount,
                    _tx.fee
                )
            );
    }

    function getTxSignBytes(Types.MassMigration memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    _tx.txType,
                    _tx.fromIndex,
                    _tx.toIndex,
                    _tx.spokeID,
                    _tx.nonce,
                    _tx.amount,
                    _tx.fee
                )
            );
    }

    function DecompressTransfers(bytes memory txs)
        internal
        pure
        returns (Tx.Transfer[] memory)
    {
        uint256 length = txs.transfer_size();
        Tx.Transfer[] memory _txs = new Tx.Transfer[](length);
        for (uint256 i = 0; i < length; i++) {
            _txs[i] = txs.transfer_decode(i);
        }
        return _txs;
    }

    function HashFromTx(Types.Transfer memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(ToBytes(_tx));
    }

    function CompressTransferFromEncoded(bytes memory txBytes, bytes memory sig)
        internal
        pure
        returns (bytes memory)
    {
        Types.Transfer memory _tx = FromBytesToTransfer(txBytes);
        Tx.Transfer[] memory _txs = new Tx.Transfer[](1);
        _txs[0] = Tx.Transfer(_tx.fromIndex, _tx.toIndex, _tx.amount, _tx.fee);
        return Tx.serialize(_txs);
    }

    function CompressManyTransferFromEncoded(
        bytes[] memory txBytes,
        bytes[] memory sigs
    ) internal pure returns (bytes memory) {
        Tx.Transfer[] memory _txs = new Tx.Transfer[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.Transfer memory _tx = FromBytesToTransfer(txBytes[i]);
            _txs[i] = Tx.Transfer(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.amount,
                _tx.fee
            );
        }
        return Tx.serialize(_txs);
    }

    function DecompressManyTransfer(bytes memory txs)
        internal
        pure
        returns (Tx.Transfer[] memory structTxs)
    {
        uint256 length = txs.transfer_size();
        structTxs = new Tx.Transfer[](length);
        for (uint256 i = 0; i < length; i++) {
            structTxs[i] = txs.transfer_decode(i);
        }
        return structTxs;
    }
}
