pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "./Tx.sol";
import { Types } from "./Types.sol";

library RollupUtils {
    using Tx for bytes;

    function CommitmentToHash(
        bytes32 stateRoot,
        bytes32 accountRoot,
        bytes32 txCommitment,
        uint256[2] memory aggregatedSignature,
        // Typechain can't parse enum for library.
        // See https://github.com/ethereum-ts/TypeChain/issues/216
        uint8 batchType
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    stateRoot,
                    accountRoot,
                    txCommitment,
                    aggregatedSignature,
                    batchType
                )
            );
    }

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

    function CompressCreateAccountFromEncoded(bytes memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Types.CreateAccount memory _tx = CreateAccountFromBytes(txBytes);
        Tx.CreateAccount[] memory _txs = new Tx.CreateAccount[](1);
        _txs[0] = Tx.CreateAccount(_tx.accountID, _tx.stateID, _tx.tokenType);
        return Tx.serialize(_txs);
    }

    function CompressManyCreateAccountFromEncoded(bytes[] memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Tx.CreateAccount[] memory _txs = new Tx.CreateAccount[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.CreateAccount memory _tx = CreateAccountFromBytes(txBytes[i]);
            _txs[i] = Tx.CreateAccount(
                _tx.accountID,
                _tx.stateID,
                _tx.tokenType
            );
        }
        return Tx.serialize(_txs);
    }

    function DecompressManyCreateAccount(bytes memory txs)
        public
        pure
        returns (Tx.CreateAccount[] memory structTxs)
    {
        uint256 length = txs.create_size();
        structTxs = new Tx.CreateAccount[](length);
        for (uint256 i = 0; i < length; i++) {
            structTxs[i] = txs.create_decode(i);
        }
        return structTxs;
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
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(txType, fromIndex, toIndex, nonce, amount));
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

    function CompressAirdropFromEncoded(bytes memory txBytes, bytes memory sig)
        public
        pure
        returns (bytes memory)
    {
        Types.DropTx memory _tx = AirdropFromBytes(txBytes);
        Tx.Transfer[] memory _txs = new Tx.Transfer[](1);
        _txs[0] = Tx.Transfer(_tx.fromIndex, _tx.toIndex, _tx.amount);
        return Tx.serialize(_txs);
    }

    function CompressManyAirdropFromEncoded(bytes[] memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Tx.Transfer[] memory _txs = new Tx.Transfer[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.DropTx memory _tx = AirdropFromBytes(txBytes[i]);
            _txs[i] = Tx.Transfer(_tx.fromIndex, _tx.toIndex, _tx.amount);
        }
        return Tx.serialize(_txs);
    }

    function DecompressManyAirdrop(bytes memory txs)
        public
        pure
        returns (Tx.Transfer[] memory structTxs)
    {
        return DecompressManyTransfer(txs);
    }

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
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(txType, fromIndex, toIndex, nonce, amount));
    }

    function CompressTx(Types.Transfer memory _tx)
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
        Types.Transfer memory _tx = TxFromBytes(message);
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

    function CompressTransferFromEncoded(bytes memory txBytes, bytes memory sig)
        public
        pure
        returns (bytes memory)
    {
        Types.Transfer memory _tx = TxFromBytes(txBytes);
        Tx.Transfer[] memory _txs = new Tx.Transfer[](1);
        _txs[0] = Tx.Transfer(_tx.fromIndex, _tx.toIndex, _tx.amount);
        return Tx.serialize(_txs);
    }

    function CompressManyTransferFromEncoded(
        bytes[] memory txBytes,
        bytes[] memory sigs
    ) public pure returns (bytes memory) {
        Tx.Transfer[] memory _txs = new Tx.Transfer[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.Transfer memory _tx = TxFromBytes(txBytes[i]);
            _txs[i] = Tx.Transfer(_tx.fromIndex, _tx.toIndex, _tx.amount);
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
        uint256 nonce,
        uint256 amount
    ) public pure returns (bytes32) {
        return
            keccak256(
                BytesFromBurnConsentNoStruct(txType, fromIndex, nonce, amount)
            );
    }

    function CompressBurnConsent(Types.BurnConsent memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx.fromIndex, _tx.amount, _tx.nonce);
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

    function CompressBurnConsentFromEncoded(bytes memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Types.BurnConsent memory _tx = BurnConsentFromBytes(txBytes);
        Tx.BurnConsent[] memory _txs = new Tx.BurnConsent[](1);
        _txs[0] = Tx.BurnConsent(_tx.fromIndex, _tx.amount);
        return Tx.serialize(_txs);
    }

    function CompressManyBurnConsentFromEncoded(bytes[] memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Tx.BurnConsent[] memory _txs = new Tx.BurnConsent[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.BurnConsent memory _tx = BurnConsentFromBytes(txBytes[i]);
            _txs[i] = Tx.BurnConsent(_tx.fromIndex, _tx.amount);
        }
        return Tx.serialize(_txs);
    }

    function DecompressManyBurnConsent(bytes memory txs)
        public
        pure
        returns (Tx.BurnConsent[] memory structTxs)
    {
        uint256 length = txs.burnConsent_size();
        structTxs = new Tx.BurnConsent[](length);
        for (uint256 i = 0; i < length; i++) {
            structTxs[i] = txs.burnConsent_decode(i);
        }
        return structTxs;
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

    function CompressBurnExecutionFromEncoded(bytes memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Types.BurnExecution memory _tx = BurnExecutionFromBytes(txBytes);
        Tx.BurnExecution[] memory _txs = new Tx.BurnExecution[](1);
        _txs[0] = Tx.BurnExecution(_tx.fromIndex);
        return Tx.serialize(_txs);
    }

    function CompressManyBurnExecutionFromEncoded(bytes[] memory txBytes)
        public
        pure
        returns (bytes memory)
    {
        Tx.BurnExecution[] memory _txs = new Tx.BurnExecution[](txBytes.length);
        for (uint256 i = 0; i < txBytes.length; i++) {
            Types.BurnExecution memory _tx = BurnExecutionFromBytes(txBytes[i]);
            _txs[i] = Tx.BurnExecution(_tx.fromIndex);
        }
        return Tx.serialize(_txs);
    }

    function DecompressManyBurnExecution(bytes memory txs)
        public
        pure
        returns (Tx.BurnExecution[] memory structTxs)
    {
        uint256 length = txs.burnExecution_size();
        structTxs = new Tx.BurnExecution[](length);
        for (uint256 i = 0; i < length; i++) {
            structTxs[i] = Tx.BurnExecution(txs.burnExecution_fromIndexOf(i));
        }
        return structTxs;
    }

    function GetYearMonth() public view returns (uint256 yearMonth) {
        uint256 _now = now;
        return _now - (_now % (4 weeks));
    }
}
