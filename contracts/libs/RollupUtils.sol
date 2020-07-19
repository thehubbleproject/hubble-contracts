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

    // AccountFromBytes decodes the bytes to account
    function AccountFromBytes(bytes memory accountBytes)
        public
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
        public
        pure
        returns (bytes memory)
    {
        bytes memory data = abi.encodePacked(
            account.ID,
            account.balance,
            account.nonce,
            account.tokenType,
            account.burn,
            account.lastBurn
        );

        return data;
    }

    function BytesFromAccountDeconstructed(
        uint256 ID,
        uint256 balance,
        uint256 nonce,
        uint256 tokenType,
        uint256 burn,
        uint256 lastBurn
    ) public pure returns (bytes memory) {
        return abi.encodePacked(ID, balance, nonce, tokenType, burn, lastBurn);
    }

    //
    // HashFromAccount and getAccountHash do the same thing i.e hash account
    //
    function getAccountHash(
        uint256 id,
        uint256 balance,
        uint256 nonce,
        uint256 tokenType,
        uint256 burn,
        uint256 lastBurn
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromAccountDeconstructed(
                    id,
                    balance,
                    nonce,
                    tokenType,
                    burn,
                    lastBurn
                )
            );
    }

    function HashFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromAccount(account));
    }

    // ---------- Tx Related Utils -------------------

    /*
        The order with:

        BytesFromX
        BytesFromXNoStruct
        XFromBytes
        XSignBytes
        CompressX
        CompressXNoStruct
        CompressXWithMessage
        DecompressX
     */

    //
    // CreateAccount
    //

    function BytesFromCreateAccount(Types.CreateAccount memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_tx.toIndex, _tx.tokenType);
    }

    function BytesFromCreateAccountNoStruct(uint256 toIndex, uint256 tokenType)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(toIndex, tokenType);
    }

    function CreateAccountTxFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.CreateAccount memory)
    {
        Types.CreateAccount memory _tx;
        (_tx.toIndex, _tx.tokenType) = abi.decode(txBytes, (uint256, uint256));
        return _tx;
    }

    function getCreateAccountSignBytes(uint256 toIndex, uint256 tokenType)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(toIndex, tokenType));
    }

    function CompressCreateAccount(Types.CreateAccount memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.toIndex, _tx.tokenType, _tx.signature);
    }

    function CompressCreateAccountNoStruct(
        uint256 toIndex,
        uint256 tokenType,
        uint256 signature
    ) public pure returns (bytes memory) {
        return abi.encode(toIndex, tokenType, signature);
    }

    function CompressCreateAccountTxWithMessage(
        bytes memory message,
        bytes memory sig
    ) public pure returns (bytes memory) {
        Types.CreateAccount memory _tx;
        (_tx.toIndex, _tx.tokenType, ) = abi.decode(
            message,
            (uint256, uint256, bytes)
        );
        return abi.encode(_tx.toIndex, _tx.tokenType, sig);
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

    //
    // Airdrop
    //

    function BytesFromAirdrop(Types.DropTx memory _tx)
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

    function BytesFromTxAirdropDeconstructed(
        uint256 from,
        uint256 to,
        uint256 tokenType,
        uint256 nonce,
        uint256 txType,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encodePacked(from, to, tokenType, nonce, txType, amount);
    }

    function AirdropTxFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.DropTx memory)
    {
        Types.DropTx memory transaction;
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

    function AirdropTxFromBytesNoStruct(bytes memory txBytes)
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

    function getDropSignBytes(
        uint256 fromIndex,
        uint256 toIndex,
        uint256 tokenType,
        uint256 txType,
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromTxAirdropDeconstructed(
                    fromIndex,
                    toIndex,
                    tokenType,
                    nonce,
                    txType,
                    amount
                )
            );
    }

    function CompressDrop(Types.DropTx memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.toIndex, _tx.amount, _tx.signature);
    }

    function CompressDropNoStruct(
        uint256 toIndex,
        uint256 amount,
        bytes memory sig
    ) public pure returns (bytes memory) {
        return abi.encodePacked(toIndex, amount, sig);
    }

    function CompressAirdropTxWithMessage(
        bytes memory message,
        bytes memory sig
    ) public pure returns (bytes memory) {
        Types.DropTx memory _tx = AirdropTxFromBytes(message);
        return abi.encode(_tx.fromIndex, _tx.toIndex, _tx.amount, sig);
    }

    function DecompressDrop(bytes memory dropBytes)
        public
        pure
        returns (Types.DropTx memory)
    {
        Types.DropTx memory drop;
        (drop.toIndex, drop.amount, drop.signature) = abi.decode(
            dropBytes,
            (uint256, uint256, bytes)
        );
        return drop;
    }

    //
    // Transfer
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

    function CompressTx(Types.Transaction memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encode(_tx.fromIndex, _tx.toIndex, _tx.amount, _tx.signature);
    }

    function CompressTxWithMessage(bytes memory message, bytes memory sig)
        public
        pure
        returns (bytes memory)
    {
        Types.Transaction memory _tx = TxFromBytes(message);
        return abi.encode(_tx.fromIndex, _tx.toIndex, _tx.amount, sig);
    }

    function DecompressTx(bytes memory txBytes)
        public
        pure
        returns (
            uint256 from,
            uint256 to,
            uint256 nonce,
            bytes memory sig
        )
    {
        return abi.decode(txBytes, (uint256, uint256, uint256, bytes));
    }

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

    function BurnConsentTxFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.BurnConsent memory)
    {
        Types.BurnConsent memory _tx;
        (_tx.fromIndex, _tx.amount, _tx.nonce, _tx.cancel) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, bool)
        );
        return _tx;
    }

    function BurnExecutionTxFromBytes(bytes memory txBytes)
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
        (_tx.fromIndex, _tx.amount, _tx.nonce, _tx.cancel, _tx.signature) = abi
            .decode(txBytes, (uint256, uint256, uint256, bool, bytes));
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

    function CompressConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.fromIndex, _tx.amount, _tx.cancel, _tx.signature);
    }

    function CompressConsentNoStruct(
        uint256 fromIndex,
        uint256 amount,
        bool cancel,
        bytes memory sig
    ) public pure returns (bytes memory) {
        return abi.encode(fromIndex, amount, cancel, sig);
    }

    function CompressExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.fromIndex);
    }

    function CompressExecutionNoStruct(
        uint256 fromIndex,
        bytes memory signature
    ) public pure returns (bytes memory) {
        return abi.encode(fromIndex, signature);
    }

    //
    // BytesFromTx and BytesFromTxDeconstructed do the same thing i.e encode transaction to bytes
    //

    function BytesFromBurnConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(_tx.fromIndex, _tx.amount, _tx.nonce, _tx.cancel);
    }

    function BytesFromBurnConsentDeconstructed(
        uint256 fromIndex,
        uint256 amount,
        uint256 nonce,
        bool cancel
    ) public pure returns (bytes memory) {
        return abi.encode(fromIndex, amount, nonce, cancel);
    }

    function BytesFromBurnExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_tx.fromIndex);
    }

    function BytesFromTxCreateAccountDeconstructed(
        uint256 to,
        uint256 tokenType
    ) public pure returns (bytes memory) {
        return abi.encodePacked(to, tokenType);
    }

    function BytesFromTxBurnExecutionDeconstructed(uint256 fromIndex)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(fromIndex);
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

    function getBurnConsentSignBytes(
        uint256 fromIndex,
        uint256 amount,
        uint256 nonce,
        bool cancel
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromBurnConsentDeconstructed(
                    fromIndex,
                    amount,
                    nonce,
                    cancel
                )
            );
    }

    function getBurnExecutionSignBytes(uint256 fromIndex)
        public
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromTxBurnExecutionDeconstructed(fromIndex));
    }

    //
    // Burn
    //

    //
    // Create Account
    //

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
        public
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

    function GetYearMonth() public view returns (uint256 yearMonth) {
        uint256 _now = now;
        return _now - (_now % (4 weeks));
    }
}
