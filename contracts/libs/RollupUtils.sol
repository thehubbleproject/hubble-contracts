pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "./Types.sol";

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
        return
            abi.encodePacked(
                _tx.txType,
                _tx.accountID,
                _tx.stateID,
                _tx.tokenType
            );
    }

    function BytesFromCreateAccountNoStruct(
        uint256 txType,
        uint256 accountID,
        uint256 stateID,
        uint256 tokenType
    ) public pure returns (bytes memory) {
        return abi.encodePacked(txType, accountID, stateID, tokenType);
    }

    function CreateAccountFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.CreateAccount memory)
    {
        Types.CreateAccount memory _tx;
        (_tx.txType, _tx.accountID, _tx.stateID, _tx.tokenType) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256)
        );
        return _tx;
    }

    function CompressCreateAccount(Types.CreateAccount memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.accountID, _tx.stateID, _tx.tokenType);
    }

    function CompressCreateAccountNoStruct(
        uint256 accountID,
        uint256 stateID,
        uint256 tokenType
    ) public pure returns (bytes memory) {
        return abi.encode(accountID, stateID, tokenType);
    }

    function CompressCreateAccountWithMessage(bytes memory message)
        public
        pure
        returns (bytes memory)
    {
        Types.CreateAccount memory _tx = CreateAccountFromBytes(message);
        return abi.encode(_tx.accountID, _tx.stateID, _tx.tokenType);
    }

    function DecompressCreateAccount(bytes memory txBytes)
        public
        pure
        returns (
            uint256 accountID,
            uint256 stateID,
            uint256 tokenType
        )
    {
        return abi.decode(txBytes, (uint256, uint256, uint256));
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
                _tx.txType,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.nonce,
                _tx.amount
            );
    }

    function BytesFromAirdropNoStruct(
        uint256 txType,
        uint256 from,
        uint256 to,
        uint256 tokenType,
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encodePacked(txType, from, to, tokenType, nonce, amount);
    }

    function AirdropFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.DropTx memory)
    {
        Types.DropTx memory transaction;
        (
            transaction.txType,
            transaction.fromIndex,
            transaction.toIndex,
            transaction.tokenType,
            transaction.nonce,
            transaction.amount
        ) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256)
        );
        return transaction;
    }

    function AirdropFromBytesNoStruct(bytes memory txBytes)
        public
        pure
        returns (
            uint256 txType,
            uint256 from,
            uint256 to,
            uint256 tokenType,
            uint256 nonce,
            uint256 amount
        )
    {
        return
            abi.decode(
                txBytes,
                (uint256, uint256, uint256, uint256, uint256, uint256)
            );
    }

    function AirdropSignBytes(
        uint256 txType,
        uint256 fromIndex,
        uint256 toIndex,
        uint256 tokenType,
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromAirdropNoStruct(
                    txType,
                    fromIndex,
                    toIndex,
                    tokenType,
                    nonce,
                    amount
                )
            );
    }

    function CompressAirdrop(Types.DropTx memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.toIndex, _tx.amount, _tx.signature);
    }

    function CompressAirdropNoStruct(
        uint256 toIndex,
        uint256 amount,
        bytes memory sig
    ) public pure returns (bytes memory) {
        return abi.encode(toIndex, amount, sig);
    }

    function CompressAirdropTxWithMessage(
        bytes memory message,
        bytes memory sig
    ) public pure returns (bytes memory) {
        Types.DropTx memory _tx = AirdropFromBytes(message);
        return abi.encode(_tx.toIndex, _tx.amount, sig);
    }

    function DecompressAirdrop(bytes memory txBytes)
        public
        pure
        returns (
            uint256 toIndex,
            uint256 amount,
            bytes memory signature
        )
    {
        return abi.decode(txBytes, (uint256, uint256, bytes));
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
            abi.encode(
                _tx.txType,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.nonce,
                _tx.amount
            );
    }

    function BytesFromTxDeconstructed(
        uint256 txType,
        uint256 from,
        uint256 to,
        uint256 tokenType,
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes memory) {
        return abi.encode(txType, from, to, tokenType, nonce, amount);
    }

    function TxFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.Transaction memory)
    {
        Types.Transaction memory transaction;
        (
            transaction.txType,
            transaction.fromIndex,
            transaction.toIndex,
            transaction.tokenType,
            transaction.nonce,
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
            uint256 txType,
            uint256 from,
            uint256 to,
            uint256 tokenType,
            uint256 nonce,
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
        uint256 txType,
        uint256 fromIndex,
        uint256 toIndex,
        uint256 tokenType,
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromTxDeconstructed(
                    txType,
                    fromIndex,
                    toIndex,
                    tokenType,
                    nonce,
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
            uint256 amount,
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
                    _tx.txType,
                    _tx.fromIndex,
                    _tx.toIndex,
                    _tx.tokenType,
                    _tx.nonce,
                    _tx.amount
                )
            );
    }

    //
    // Burn Consent
    //

    function BytesFromBurnConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(_tx.txType, _tx.fromIndex, _tx.amount, _tx.nonce);
    }

    function BytesFromBurnConsentNoStruct(
        uint256 txType,
        uint256 fromIndex,
        uint256 amount,
        uint256 nonce
    ) public pure returns (bytes memory) {
        return abi.encode(txType, fromIndex, amount, nonce);
    }

    function BurnConsentFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.BurnConsent memory)
    {
        Types.BurnConsent memory _tx;
        (_tx.txType, _tx.fromIndex, _tx.amount, _tx.nonce) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256)
        );
        return _tx;
    }

    function BurnConsentSignBytes(
        uint256 txType,
        uint256 fromIndex,
        uint256 amount,
        uint256 nonce
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromBurnConsentNoStruct(txType, fromIndex, amount, nonce)
            );
    }

    function CompressBurnConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.fromIndex, _tx.amount, _tx.signature);
    }

    function CompressBurnConsentNoStruct(
        uint256 fromIndex,
        uint256 amount,
        uint256 nonce,
        bytes memory sig
    ) public pure returns (bytes memory) {
        return abi.encode(fromIndex, amount, nonce, sig);
    }

    function CompressBurnConsentWithMessage(
        bytes memory message,
        bytes memory sig
    ) public pure returns (bytes memory) {
        Types.BurnConsent memory _tx = BurnConsentFromBytes(message);
        return abi.encode(_tx.fromIndex, _tx.amount, _tx.nonce, sig);
    }

    function DecompressBurnConsent(bytes memory txBytes)
        public
        pure
        returns (
            uint256 fromIndex,
            uint256 amount,
            uint256 nonce,
            bytes memory signature
        )
    {
        return abi.decode(txBytes, (uint256, uint256, uint256, bytes));
    }

    function HashFromBurnConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes32)
    {
        return keccak256(CompressBurnConsent(_tx));
    }

    //
    // Burn Execution
    //

    function BytesFromBurnExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(_tx.txType, _tx.fromIndex);
    }

    function BytesFromBurnExecutionNoStruct(uint256 txType, uint256 fromIndex)
        public
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(txType, fromIndex);
    }

    function BurnExecutionFromBytes(bytes memory txBytes)
        public
        pure
        returns (Types.BurnExecution memory)
    {
        Types.BurnExecution memory _tx;
        (_tx.txType, _tx.fromIndex) = abi.decode(txBytes, (uint256, uint256));
        return _tx;
    }

    function BurnExecutionSignBytes(uint256 txType, uint256 fromIndex)
        public
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromBurnExecutionNoStruct(txType, fromIndex));
    }

    function CompressBurnExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.fromIndex);
    }

    function CompressBurnExecutionWithMessage(bytes memory message)
        public
        pure
        returns (bytes memory)
    {
        Types.BurnExecution memory _tx = BurnExecutionFromBytes(message);
        return abi.encode(_tx.fromIndex);
    }

    function CompressBurnExecutionNoStruct(uint256 fromIndex)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(fromIndex);
    }

    function DecompressBurnExecution(bytes memory txBytes)
        public
        pure
        returns (uint256 fromIndex)
    {
        return abi.decode(txBytes, (uint256));
    }

    function HashFromBurnExecution(Types.BurnExecution memory _tx)
        public
        pure
        returns (bytes32)
    {
        return keccak256(CompressBurnExecution(_tx));
    }

    function GetYearMonth() public view returns (uint256 yearMonth) {
        uint256 _now = now;
        return _now - (_now % (4 weeks));
    }
}
