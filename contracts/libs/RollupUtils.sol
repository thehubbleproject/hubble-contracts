pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Types} from "./Types.sol";

library RollupUtils {
    // ---------- Account Related Utils -------------------
    function PDALeafToHash(Types.PDALeaf memory _PDA_Leaf)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(_PDA_Leaf.pubkey));
    }

    // returns a new User Account with updated balance
    function UpdateBalanceInAccount(
        Types.UserAccount memory original_account,
        uint256 new_balance
    ) public pure returns (Types.UserAccount memory updated_account) {
        original_account.balance = new_balance;
        return original_account;
    }

    function BalanceFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (uint256)
    {
        return account.balance;
    }

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

    //
    // BytesFromAccount and BytesFromAccountDeconstructed do the same thing i.e encode account to bytes
    //
    function BytesFromAccount(Types.UserAccount memory account)
        public
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

    function BytesFromAccountDeconstructed(
        uint256 ID,
        uint256 balance,
        uint256 nonce,
        uint256 tokenType
    ) public pure returns (bytes memory) {
        return abi.encodePacked(ID, balance, nonce, tokenType);
    }

    //
    // HashFromAccount and getAccountHash do the same thing i.e hash account
    //
    function getAccountHash(
        uint256 id,
        uint256 balance,
        uint256 nonce,
        uint256 tokenType
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromAccountDeconstructed(id, balance, nonce, tokenType)
            );
    }

    function HashFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                BytesFromAccountDeconstructed(
                    account.ID,
                    account.balance,
                    account.nonce,
                    account.tokenType
                )
            );
    }

    // ---------- Tx Related Utils -------------------
    function CompressTx(Types.Transaction memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.amount,
                _tx.signature
            );
    }

    function DecompressTx(bytes memory txBytes)
        public
        pure
        returns (
            uint256 from,
            uint256 to,
            uint256 tokenType,
            uint256 nonce,
            bytes memory sig
        )
    {
        return abi.decode(txBytes, (uint256, uint256, uint256, uint256, bytes));
    }

    function CompressTxWithMessage(bytes memory message, bytes memory sig)
        public
        pure
        returns (bytes memory)
    {
        Types.Transaction memory _tx = TxFromBytes(message);
        return
            abi.encode(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.amount,
                sig
            );
    }

    // Decoding transaction from bytes
    function TxFromBytesDeconstructed(bytes memory txBytes)
        public
        pure
        returns (
            uint256 from,
            uint256 to,
            uint256 tokenType,
            uint256 nonce,
            uint256 txType,
            uint256 amount
        )
    {
        return
            abi.decode(
                txBytes,
                (uint256, uint256, uint256, uint256, uint256, uint256)
            );
    }

    function TxFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.Transaction memory)
    {
        Types.Transaction memory transaction;
        (
            transaction.fromIndex,
            transaction.toIndex,
            transaction.tokenType,
            transaction.nonce,
            transaction.txType,
            transaction.amount
        ) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256)
        );
        return transaction;
    }

    function TxFromBytesAirdrop(bytes memory txBytes)
        public
        pure
        returns (Types.Drop memory)
    {
        Types.Drop memory _tx;
        (_tx.toIndex, _tx.tokenType, _tx.epoch, _tx.amount) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256)
        );
        return _tx;
    }

    function TxFromBytesBurnConsent(bytes memory txBytes)
        public
        pure
        returns (Types.BurnConsent memory)
    {
        Types.BurnConsent memory _tx;
        (_tx.fromIndex, _tx.amount, _tx.cancel, _tx.signature) = abi.decode(
            txBytes,
            (uint256, uint256, bool, bytes)
        );
        return _tx;
    }

    function TxFromBytesBurnExecution(bytes memory txBytes)
        public
        pure
        returns (Types.BurnExecution memory)
    {
        Types.BurnExecution memory _tx;
        _tx.fromIndex = abi.decode(txBytes, (uint256));
        return _tx;
    }

    function DecompressConsent(bytes memory txBytes)
        public
        pure
        returns (Types.BurnConsent memory)
    {
        Types.BurnConsent memory _tx;
        (_tx.fromIndex, _tx.amount, _tx.cancel, _tx.signature) = abi.decode(
            txBytes,
            (uint256, uint256, bool, bytes)
        );
        return _tx;
    }

    function DecompressExecution(bytes memory txBytes)
        public
        pure
        returns (Types.BurnExecution memory)
    {
        Types.BurnExecution memory _tx;
        _tx.fromIndex = abi.decode(txBytes, (uint256));
        return _tx;
    }

    function DecompressCreateAccount(bytes memory txBytes)
        public
        pure
        returns (Types.CreateAccount memory)
    {
        Types.CreateAccount memory _tx;
        (_tx.toIndex, _tx.tokenType) = abi.decode(txBytes, (uint256, uint256));
        return _tx;
    }

    function CompressDrop(Types.Drop memory drop)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(drop);
    }

    function CompressConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx);
    }

    function CompressExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx);
    }

    function CompressCreateAccount(Types.CreateAccount memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx);
    }

    function CompressDropNoStruct(
        uint256 toIndex,
        uint256 tokenType,
        uint256 epoch,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encodePacked(toIndex, tokenType, epoch, amount);
    }

    function DecompressDrop(bytes memory dropBytes)
        public
        pure
        returns (Types.Drop memory)
    {
        Types.Drop memory drop;
        (
            drop.toIndex,
            drop.tokenType,
            drop.epoch,
            drop.amount,
            // drop.signature

        ) = abi.decode(dropBytes, (uint256, uint256, uint256, uint256, bytes));
        return drop;
    }

    //
    // BytesFromTx and BytesFromTxDeconstructed do the same thing i.e encode transaction to bytes
    //
    function BytesFromTx(Types.Transaction memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.nonce,
                _tx.txType,
                _tx.amount
            );
    }

    function BytesFromCreateAccount(Types.CreateAccount memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_tx.toIndex, _tx.tokenType);
    }

    function BytesFromAirdrop(Types.Drop memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(_tx.toIndex, _tx.tokenType, _tx.epoch, _tx.amount);
    }

    function BytesFromBurnConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_tx.fromIndex, _tx.amount, _tx.cancel);
    }

    function BytesFromBurnExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_tx.fromIndex);
    }

    function getDropSignBytes(
        uint256 toIndex,
        uint256 tokenType,
        uint256 epoch,
        uint256 amount
    ) public pure returns (bytes32) {
        return
            keccak256(CompressDropNoStruct(toIndex, tokenType, epoch, amount));
    }

    function BytesFromTxDeconstructed(
        uint256 from,
        uint256 to,
        uint256 tokenType,
        uint256 nonce,
        uint256 txType,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encodePacked(from, to, tokenType, nonce, txType, amount);
    }

    function BytesFromTxCreateAccountDeconstructed(
        uint256 to,
        uint256 tokenType
    ) public pure returns (bytes memory) {
        return abi.encodePacked(to, tokenType);
    }

    function BytesFromTxAirdropDeconstructed(
        uint256 to,
        uint256 tokenType,
        uint256 epoch,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encodePacked(to, tokenType, epoch, amount);
    }

    function BytesFromTxBurnConsentDeconstructed(
        uint256 from,
        uint256 amount,
        bool cancel
    ) public pure returns (bytes memory) {
        return abi.encodePacked(from, amount, cancel);
    }

    function BytesFromTxBurnExecutionDeconstructed(uint256 from)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(from);
    }

    //
    // HashFromTx and getTxSignBytes do the same thing i.e get the tx data to be signed
    //
    function HashFromTx(Types.Transaction memory _tx)
        public
        pure
        returns (bytes32)
    {
        return
            keccak256(
                BytesFromTxDeconstructed(
                    _tx.fromIndex,
                    _tx.toIndex,
                    _tx.tokenType,
                    _tx.nonce,
                    _tx.txType,
                    _tx.amount
                )
            );
    }

    function HashFromConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes32)
    {
        return keccak256(CompressConsent(_tx));
    }

    function HashFromExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes32)
    {
        return keccak256(CompressExecution(_tx));
    }

    function getTxSignBytes(
        uint256 fromIndex,
        uint256 toIndex,
        uint256 tokenType,
        uint256 txType,
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromTxDeconstructed(
                    fromIndex,
                    toIndex,
                    tokenType,
                    nonce,
                    txType,
                    amount
                )
            );
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
        Types.UserAccount memory account1 = Types.UserAccount({
            ID: 0,
            tokenType: 0,
            balance: 0,
            nonce: 0
        });
        Types.UserAccount memory account2 = Types.UserAccount({
            ID: 1,
            tokenType: 0,
            balance: 0,
            nonce: 0
        });
        leaves[0] = HashFromAccount(account1);
        leaves[1] = HashFromAccount(account2);
    }

    function GetGenesisDataBlocks()
        public
        pure
        returns (bytes[2] memory dataBlocks)
    {
        Types.UserAccount memory account1 = Types.UserAccount({
            ID: 0,
            tokenType: 0,
            balance: 0,
            nonce: 0
        });
        Types.UserAccount memory account2 = Types.UserAccount({
            ID: 1,
            tokenType: 0,
            balance: 0,
            nonce: 0
        });
        dataBlocks[0] = BytesFromAccount(account1);
        dataBlocks[1] = BytesFromAccount(account2);
    }
}
