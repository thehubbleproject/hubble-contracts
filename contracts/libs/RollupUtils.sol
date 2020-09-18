pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "./Tx.sol";
import { Types } from "./Types.sol";

library RollupUtilsLib {
    function BytesFromAccount(Types.UserAccount memory account)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory data = abi.encodePacked(
            account.ID,
            account.balance,
            account.nonce,
            account.tokenType
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
}

contract RollupUtils {
    using Tx for bytes;

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

    // ---------- Account Related Utils -------------------

    // AccountFromBytes decodes the bytes to account
    function AccountFromBytes(bytes memory accountBytes)
        public
        pure
        returns (
            uint256 ID,
            uint256 balance,
            uint256 nonce,
            uint256 tokenType
        )
    {
        return abi.decode(accountBytes, (uint256, uint256, uint256, uint256));
    }

    function BytesFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (bytes memory)
    {
        return RollupUtilsLib.BytesFromAccount(account);
    }

    function HashFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (bytes32)
    {
        return RollupUtilsLib.HashFromAccount(account);
    }

    /**
     * @notice Calculates the address from the pubkey
     * @param pub is the pubkey
     * @return Returns the address that has been calculated from the pubkey
     */
    function calculateAddress(bytes memory pub)
        public
        pure
        returns (address addr)
    {
        bytes32 hash = keccak256(pub);
        assembly {
            mstore(0, hash)
            addr := mload(0)
        }
    }

    function GetGenesisLeaves() public pure returns (bytes32[2] memory leaves) {
        Types.UserAccount memory account1;
        account1.ID = 0;
        Types.UserAccount memory account2;
        account2.ID = 1;
        leaves[0] = HashFromAccount(account1);
        leaves[1] = HashFromAccount(account2);
    }

    // ---------- Tx Related Utils -------------------

    //
    // Transfer
    //

    function BytesFromTx(Types.Transfer memory _tx)
        public
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

    function TxFromBytes(bytes memory txBytes)
        public
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

    function getTxSignBytes(
        uint256 txType,
        uint256 fromIndex,
        uint256 toIndex,
        uint256 nonce,
        uint256 amount,
        uint256 fee
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(txType, fromIndex, toIndex, nonce, amount, fee)
            );
    }

    function DecompressTransfers(bytes memory txs)
        public
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
        public
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromTx(_tx));
    }

    function CompressTransferFromEncoded(bytes memory txBytes, bytes memory sig)
        public
        pure
        returns (bytes memory)
    {
        Types.Transfer memory _tx = TxFromBytes(txBytes);
        Tx.Transfer[] memory _txs = new Tx.Transfer[](1);
        _txs[0] = Tx.Transfer(_tx.fromIndex, _tx.toIndex, _tx.amount, _tx.fee);
        return Tx.serialize(_txs);
    }

    function CompressManyTransferFromEncoded(
        bytes[] memory txBytes,
        bytes[] memory sigs
    ) public pure returns (bytes memory) {
        Tx.Transfer[] memory _txs = new Tx.Transfer[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.Transfer memory _tx = TxFromBytes(txBytes[i]);
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
        public
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
