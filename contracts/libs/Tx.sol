pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { BLS } from "./BLS.sol";
import { Types } from "./Types.sol";

library Tx {
    // Tx types in uint256
    uint256 constant TRANSFER = 1;
    uint256 constant CREATE_ACCOUNT = 2;
    uint256 constant AIRDROP = 3;
    uint256 constant BURN_CONCENT = 4;
    uint256 constant BURN_EXECUTION = 5;

    uint256 public constant MASK_ACCOUNT_ID = 0xffffffff;
    uint256 public constant MASK_STATE_ID = 0xffffffff;
    uint256 public constant MASK_AMOUNT = 0xffffffff;
    uint256 public constant MASK_FEE = 0xffffffff;
    uint256 public constant MASK_NONCE = 0xffffffff;
    uint256 public constant MASK_SPOKE = 0xffffffff;
    uint256 public constant MASK_TOKEN_ID = 0xffff;
    uint256 public constant MASK_BYTE = 0xff;

    // transaction_type: transfer
    // [sender_state_id<4>|receiver_state_id<4>|amount<4>|fee<4>]
    uint256 public constant TX_LEN_0 = 16;
    // positions in bytes
    uint256 public constant POSITION_SENDER_0 = 4;
    uint256 public constant POSITION_RECEIVER_0 = 8;
    uint256 public constant POSITION_AMOUNT_0 = 12;
    uint256 public constant POSITION_FEE_0 = 16;

    // transaction_type: Mass Migrations
    // [sender_state_id<4>|receiver_state_id<4>|amount<4>|spokeID<4>|fee<4>]
    uint256 public constant TX_LEN_5 = 20;
    // positions in bytes
    uint256 public constant POSITION_SENDER_5 = 4;
    uint256 public constant POSITION_RECEIVER_5 = 8;
    uint256 public constant POSITION_AMOUNT_5 = 12;
    uint256 public constant POSITION_SPOKE_5 = 16;
    uint256 public constant POSITION_FEE_6 = 20;

    struct Transfer {
        uint256 fromIndex;
        uint256 toIndex;
        uint256 amount;
        uint256 fee;
    }
    struct MassMigration {
        uint256 fromIndex;
        uint256 toIndex;
        uint256 amount;
        uint256 spokeID;
        uint256 fee;
    }

    // Transfer

    function transfer_hasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_0 != 0;
    }

    function transfer_size(bytes memory txs) internal pure returns (uint256) {
        return txs.length / TX_LEN_0;
    }

    function transfer_fromEncoded(bytes memory txBytes)
        internal
        pure
        returns (Tx.Transfer memory, uint256 tokenType)
    {
        Types.Transfer memory _tx;
        (
            _tx.txType,
            _tx.fromIndex,
            _tx.toIndex,
            _tx.tokenType,
            _tx.nonce,
            _tx.amount,
            _tx.fee
        ) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        Tx.Transfer memory _txCompressed = Tx.Transfer(
            _tx.fromIndex,
            _tx.toIndex,
            _tx.amount,
            _tx.fee
        );
        return (_txCompressed, _tx.tokenType);
    }

    function serialize(bytes[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_0 * batchSize);
        for (uint256 i = 0; i < txs.length; i++) {
            uint256 fromIndex;
            uint256 toIndex;
            uint256 amount;
            uint256 fee;
            (, fromIndex, toIndex, , , amount, fee) = abi.decode(
                txs[i],
                (uint256, uint256, uint256, uint256, uint256, uint256, uint256)
            );
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(amount),
                uint32(fee)
            );
            uint256 off = i * TX_LEN_0;
            for (uint256 j = 0; j < TX_LEN_0; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(Transfer[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_0 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            uint256 toIndex = txs[i].toIndex;
            uint256 amount = txs[i].amount;
            uint256 fee = txs[i].fee;
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(amount),
                uint32(fee)
            );
            uint256 off = i * TX_LEN_0;
            for (uint256 j = 0; j < TX_LEN_0; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function transfer_serializeFromEncoded(Types.Transfer[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_0 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            uint256 toIndex = txs[i].toIndex;
            uint256 amount = txs[i].amount;
            uint256 fee = txs[i].fee;
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(amount),
                uint32(fee)
            );
            uint256 off = i * TX_LEN_0;
            for (uint256 j = 0; j < TX_LEN_0; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function transfer_decodedToLeafs(Transfer[] memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = txs.length;
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = keccak256(
                abi.encodePacked(
                    uint32(txs[i].fromIndex),
                    uint32(txs[i].toIndex),
                    uint32(txs[i].amount),
                    uint32(txs[i].fee)
                )
            );
        }
        return buf;
    }

    function transfer_decode(bytes memory txs, uint256 index)
        internal
        pure
        returns (Transfer memory _tx)
    {
        uint256 sender;
        uint256 receiver;
        uint256 amount;
        uint256 fee;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            sender := and(mload(add(p_tx, POSITION_SENDER_0)), MASK_STATE_ID)
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_0)),
                MASK_STATE_ID
            )
            amount := and(mload(add(p_tx, POSITION_AMOUNT_0)), MASK_AMOUNT)
            fee := and(mload(add(p_tx, POSITION_FEE_0)), MASK_FEE)
        }
        return Transfer(sender, receiver, amount, fee);
    }

    function transfer_fromIndexOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            receiver := and(mload(add(p_tx, POSITION_SENDER_0)), MASK_STATE_ID)
        }
    }

    function transfer_toIndexOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 sender)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            sender := and(mload(add(p_tx, POSITION_RECEIVER_0)), MASK_STATE_ID)
        }
    }

    function transfer_amountOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 amount)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            amount := and(mload(add(p_tx, POSITION_AMOUNT_0)), MASK_AMOUNT)
        }
    }

    function transfer_feeOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 fee)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            fee := and(mload(add(p_tx, POSITION_FEE_0)), MASK_FEE)
        }
    }

    function transfer_hashOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (bytes32 result)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_0), 32))
            result := keccak256(p_tx, TX_LEN_0)
        }
    }

    function transfer_toLeafs(bytes memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = transfer_size(txs);
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = transfer_hashOf(txs, i);
        }
        return buf;
    }

    function transfer_messageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce
    ) internal pure returns (bytes32) {
        Transfer memory _tx = transfer_decode(txs, index);
        return
            keccak256(
                abi.encodePacked(
                    TRANSFER,
                    _tx.fromIndex,
                    _tx.toIndex,
                    nonce,
                    _tx.amount
                )
            );
    }

    function massMigration_decode(bytes memory txs, uint256 index)
        internal
        pure
        returns (MassMigration memory _tx)
    {
        uint256 sender;
        uint256 receiver;
        uint256 amount;
        uint256 spokeID;
        uint256 fee;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_5))
            sender := and(mload(add(p_tx, POSITION_SENDER_5)), MASK_STATE_ID)
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_5)),
                MASK_STATE_ID
            )
            amount := and(mload(add(p_tx, POSITION_AMOUNT_5)), MASK_AMOUNT)
            spokeID := and(mload(add(p_tx, POSITION_SPOKE_5)), MASK_SPOKE)
            fee := and(mload(add(p_tx, POSITION_FEE_0)), MASK_FEE)
        }
        return MassMigration(sender, receiver, amount, spokeID, fee);
    }

    function massMigration_size(bytes memory txs)
        internal
        pure
        returns (uint256)
    {
        return txs.length / TX_LEN_5;
    }
}
