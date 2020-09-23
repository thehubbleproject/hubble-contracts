pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "./Tx.sol";
import { Types } from "./Types.sol";

contract RollupUtils {
    using Tx for bytes;
    using Types for Types.UserState;

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

    function StateFromBytes(bytes memory stateBytes)
        public
        pure
        returns (Types.UserState memory state)
    {
        (state.pubkeyIndex, state.tokenType, state.balance, state.nonce) = abi
            .decode(stateBytes, (uint256, uint256, uint256, uint256));
    }

    function BytesFromState(Types.UserState memory state)
        public
        pure
        returns (bytes memory)
    {
        return state.encode();
    }

    function HashFromState(Types.UserState memory state)
        public
        pure
        returns (bytes32)
    {
        return keccak256(state.encode());
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
        Types.UserState memory state1;
        state1.pubkeyIndex = 0;
        Types.UserState memory state2;
        state2.pubkeyIndex = 1;
        leaves[0] = keccak256(state1.encode());
        leaves[1] = keccak256(state2.encode());
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

    function getTxSignBytes(Types.Transfer memory _tx)
        public
        pure
        returns (bytes memory)
    {
        Types.Transfer[] memory _txx = new Types.Transfer[](1);
        _txx[0] = _tx;
        bytes memory txs = Tx.transfer_serializeFromEncoded(_txx);
        return Tx.transfer_messageOf(txs, 0, _tx.nonce);
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
