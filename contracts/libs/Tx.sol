pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { BLS } from "./BLS.sol";

library Tx {
    // Tx types in uint256
    uint256 private constant TRANSFER = 1;
    uint256 private constant CREATE2TRANSFER = 3;
    uint256 private constant MASS_MIGRATION = 5;

    uint256 public constant MASK_ACCOUNT_ID = 0xffffffff;
    uint256 public constant MASK_STATE_ID = 0xffffffff;
    uint256 public constant MASK_AMOUNT = 0xffffffff;
    uint256 public constant MASK_FEE = 0xffffffff;
    uint256 public constant MASK_EXPONENT = 0xf000;
    uint256 public constant MANTISSA_BITS = 12;
    uint256 public constant MASK_MANTISSA = 0x0fff;
    uint256 public constant MASK_NONCE = 0xffffffff;
    uint256 public constant MASK_TOKEN_ID = 0xffff;
    uint256 public constant MASK_BYTE = 0xff;

    // transaction_type: transfer
    // [sender_state_id<4>|receiver_state_id<4>|amount<2>|fee<2>]
    uint256 public constant TX_LEN_0 = 12;
    // positions in bytes
    uint256 public constant POSITION_SENDER_0 = 4;
    uint256 public constant POSITION_RECEIVER_0 = 8;
    uint256 public constant POSITION_AMOUNT_0 = 10;
    uint256 public constant POSITION_FEE_0 = 12;

    // transaction_type: create2Transfer
    // [sender_state_id<4>|receiver_state_id<4>|receiver_acc_id<4>|amount<2>|fee<2>]
    uint256 public constant TX_LEN_1 = 16;
    // positions in bytes
    uint256 public constant POSITION_SENDER_1 = 4;
    uint256 public constant POSITION_RECEIVER_1 = 8;
    uint256 public constant POSITION_RECEIVER_ACCID_1 = 12;
    uint256 public constant POSITION_AMOUNT_1 = 14;
    uint256 public constant POSITION_FEE_1 = 16;

    // transaction_type: Mass Migrations
    // [sender_state_id<4>|amount<2>|fee<2>]
    uint256 public constant TX_LEN_5 = 8;
    // positions in bytes
    uint256 public constant POSITION_SENDER_5 = 4;
    uint256 public constant POSITION_AMOUNT_5 = 6;
    uint256 public constant POSITION_FEE_5 = 8;

    struct Transfer {
        uint256 fromIndex;
        uint256 toIndex;
        uint256 amount;
        uint256 fee;
    }

    struct Create2Transfer {
        uint256 fromIndex;
        uint256 toIndex;
        uint256 toAccID;
        uint256 amount;
        uint256 fee;
    }

    struct MassMigration {
        uint256 fromIndex;
        uint256 amount;
        uint256 fee;
    }

    // Transfer

    function transferHasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_0 != 0;
    }

    // num of txs in the bytes blob
    function transferSize(bytes memory txs) internal pure returns (uint256) {
        return txs.length / TX_LEN_0;
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
            uint256 amount = encodeDecimal(txs[i].amount);
            uint256 fee = encodeDecimal(txs[i].fee);
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint16(amount),
                uint16(fee)
            );
            uint256 off = i * TX_LEN_0;
            for (uint256 j = 0; j < TX_LEN_0; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(MassMigration[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_5 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            uint256 amount = encodeDecimal(txs[i].amount);
            uint256 fee = encodeDecimal(txs[i].fee);
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint16(amount),
                uint16(fee)
            );
            uint256 off = i * TX_LEN_5;
            for (uint256 j = 0; j < TX_LEN_5; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(Create2Transfer[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_1 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            uint256 toIndex = txs[i].toIndex;
            uint256 toAccID = txs[i].toAccID;
            uint256 amount = txs[i].amount;
            uint256 fee = txs[i].fee;
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(toAccID),
                uint16(encodeDecimal(amount)),
                uint16(encodeDecimal(fee))
            );
            uint256 off = i * TX_LEN_1;
            for (uint256 j = 0; j < TX_LEN_1; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function encodeDecimal(uint256 input) internal pure returns (uint256) {
        // Copy to avoid assigning to the function parameter.
        uint256 x = input;
        uint256 exponent = 0;
        for (uint256 i = 0; i < 15; i++) {
            if (x != 0 && x % 10 == 0) {
                x = x / 10;
                exponent += 1;
            } else {
                break;
            }
        }
        require(x <= 0x0fff, "Bad input");
        return (exponent << 12) + x;
    }

    function transferDecode(bytes memory txs, uint256 index)
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
            let amountBytes := mload(add(p_tx, POSITION_AMOUNT_0))
            let amountExponent := shr(
                MANTISSA_BITS,
                and(amountBytes, MASK_EXPONENT)
            )
            let amountMantissa := and(amountBytes, MASK_MANTISSA)
            amount := mul(amountMantissa, exp(10, amountExponent))
            let feeBytes := mload(add(p_tx, POSITION_FEE_0))
            let feeExponent := shr(MANTISSA_BITS, and(feeBytes, MASK_EXPONENT))
            let feeMantissa := and(feeBytes, MASK_MANTISSA)
            fee := mul(feeMantissa, exp(10, feeExponent))
        }
        return Transfer(sender, receiver, amount, fee);
    }

    function transferMessageOf(Transfer memory _tx, uint256 nonce)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                TRANSFER,
                _tx.fromIndex,
                _tx.toIndex,
                nonce,
                _tx.amount,
                _tx.fee
            );
    }

    function create2TransferHasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_1 != 0;
    }

    function create2TransferSize(bytes memory txs)
        internal
        pure
        returns (uint256)
    {
        return txs.length / TX_LEN_1;
    }

    function create2TransferDecode(bytes memory txs, uint256 index)
        internal
        pure
        returns (Create2Transfer memory _tx)
    {
        uint256 sender;
        uint256 receiver;
        uint256 receiverAccID;
        uint256 amount;
        uint256 fee;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            sender := and(mload(add(p_tx, POSITION_SENDER_1)), MASK_STATE_ID)
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_1)),
                MASK_STATE_ID
            )
            receiverAccID := and(
                mload(add(p_tx, POSITION_RECEIVER_ACCID_1)),
                MASK_ACCOUNT_ID
            )
            let amountBytes := mload(add(p_tx, POSITION_AMOUNT_1))
            let amountExponent := shr(
                MANTISSA_BITS,
                and(amountBytes, MASK_EXPONENT)
            )
            let amountMantissa := and(amountBytes, MASK_MANTISSA)
            amount := mul(amountMantissa, exp(10, amountExponent))
            let feeBytes := mload(add(p_tx, POSITION_FEE_1))
            let feeExponent := shr(MANTISSA_BITS, and(feeBytes, MASK_EXPONENT))
            let feeMantissa := and(feeBytes, MASK_MANTISSA)
            fee := mul(feeMantissa, exp(10, feeExponent))
        }
        return Create2Transfer(sender, receiver, receiverAccID, amount, fee);
    }

    function create2TransferMessageOf(
        Create2Transfer memory _tx,
        uint256 nonce,
        uint256[4] memory from,
        uint256[4] memory to
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                CREATE2TRANSFER,
                from,
                to,
                nonce,
                _tx.amount,
                _tx.fee
            );
    }

    function massMigrationDecode(bytes memory txs, uint256 index)
        internal
        pure
        returns (MassMigration memory _tx)
    {
        uint256 sender;
        uint256 amount;
        uint256 fee;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_5))
            sender := and(mload(add(p_tx, POSITION_SENDER_5)), MASK_STATE_ID)
            let amountBytes := mload(add(p_tx, POSITION_AMOUNT_5))
            let amountExponent := shr(
                MANTISSA_BITS,
                and(amountBytes, MASK_EXPONENT)
            )
            let amountMantissa := and(amountBytes, MASK_MANTISSA)
            amount := mul(amountMantissa, exp(10, amountExponent))
            let feeBytes := mload(add(p_tx, POSITION_FEE_5))
            let feeExponent := shr(MANTISSA_BITS, and(feeBytes, MASK_EXPONENT))
            let feeMantissa := and(feeBytes, MASK_MANTISSA)
            fee := mul(feeMantissa, exp(10, feeExponent))
        }
        return MassMigration(sender, amount, fee);
    }

    function massMigrationSize(bytes memory txs)
        internal
        pure
        returns (uint256)
    {
        return txs.length / TX_LEN_5;
    }

    function massMigrationMessageOf(
        MassMigration memory _tx,
        uint256 nonce,
        uint256 spokeID
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                uint8(MASS_MIGRATION),
                uint32(_tx.fromIndex),
                _tx.amount,
                _tx.fee,
                uint32(nonce),
                uint32(spokeID)
            );
    }
}
