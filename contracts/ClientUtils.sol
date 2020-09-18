pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "./libs/Tx.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract ClientUtils {
    function CommitmentToHash(
        bytes32 stateRoot,
        bytes32 accountRoot,
        uint256[2] memory signature,
        bytes memory txs,
        uint256 tokenType,
        uint256 feeReceiver,
        uint8 batchType
    ) public pure returns (bytes32) {
        return
            RollupUtils.CommitmentToHash(
                stateRoot,
                accountRoot,
                signature,
                txs,
                tokenType,
                feeReceiver,
                batchType
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
    ) public pure returns (bytes32) {
        return
            RollupUtils.MMCommitmentToHash(
                stateRoot,
                accountRoot,
                txs,
                tokenID,
                amount,
                withdrawRoot,
                targetSpokeID,
                aggregatedSignature
            );
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
            uint256 tokenType,
            uint256 burn,
            uint256 lastBurn
        )
    {
        return RollupUtils.AccountFromBytes(accountBytes);
    }

    //
    // BytesFromAccount and BytesFromAccountDeconstructed do the same thing i.e encode account to bytes
    //
    function BytesFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (bytes memory data)
    {
        return RollupUtils.BytesFromAccount(account);
    }

    function HashFromAccount(Types.UserAccount memory account)
        public
        pure
        returns (bytes32)
    {
        return RollupUtils.HashFromAccount(account);
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
        return RollupUtils.calculateAddress(pub);
    }

    function GetGenesisLeaves() public pure returns (bytes32[2] memory leaves) {
        return RollupUtils.GetGenesisLeaves();
    }

    function GetGenesisDataBlocks()
        public
        pure
        returns (bytes[2] memory dataBlocks)
    {
        return RollupUtils.GetGenesisDataBlocks();
    }

    // ---------- Tx Related Utils -------------------

    function TransferToBytes(Types.Transfer memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return RollupUtils.ToBytes(_tx);
    }

    function MMToBytes(Types.MassMigration memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return RollupUtils.ToBytes(_tx);
    }

    function FromBytesToTransfer(bytes calldata txBytes)
        external
        pure
        returns (Types.Transfer memory)
    {
        return RollupUtils.FromBytesToTransfer(txBytes);
    }

    function FromBytesToMassMigration(bytes memory txBytes)
        public
        pure
        returns (Types.MassMigration memory transaction)
    {
        return RollupUtils.FromBytesToMassMigration(txBytes);
    }

    function getTransferSignBytes(Types.Transfer memory _tx)
        public
        pure
        returns (bytes32)
    {
        return RollupUtils.getTxSignBytes(_tx);
    }

    function getMassMigrationSignBytes(Types.MassMigration memory _tx)
        public
        pure
        returns (bytes32)
    {
        return RollupUtils.getTxSignBytes(_tx);
    }

    function DecompressTransfers(bytes memory txs)
        public
        pure
        returns (Tx.Transfer[] memory)
    {
        return RollupUtils.DecompressTransfers(txs);
    }

    function HashFromTx(Types.Transfer memory _tx)
        public
        pure
        returns (bytes32)
    {
        return RollupUtils.HashFromTx(_tx);
    }

    function CompressTransferFromEncoded(bytes memory txBytes, bytes memory sig)
        public
        pure
        returns (bytes memory)
    {
        return RollupUtils.CompressTransferFromEncoded(txBytes, sig);
    }

    function CompressManyTransferFromEncoded(
        bytes[] memory txBytes,
        bytes[] memory sigs
    ) public pure returns (bytes memory) {
        return RollupUtils.CompressManyTransferFromEncoded(txBytes, sigs);
    }

    function DecompressManyTransfer(bytes memory txs)
        public
        pure
        returns (Tx.Transfer[] memory structTxs)
    {
        return RollupUtils.DecompressManyTransfer(txs);
    }
}
