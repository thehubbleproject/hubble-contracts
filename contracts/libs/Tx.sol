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
    uint256 public constant MASK_NONCE = 0xffffffff;
    uint256 public constant MASK_TOKEN_ID = 0xffff;
    uint256 public constant MASK_BYTE = 0xff;

    // transaction_type: transfer
    // [sender_state_id<4>|receiver_state_id<4>|amount<4>]
    uint256 public constant TX_LEN_0 = 12;
    uint256 public constant MASK_TX_0 = 0xffffffffffffffffffffffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_SENDER_0 = 4;
    uint256 public constant POSITION_RECEIVER_0 = 8;
    uint256 public constant POSITION_AMOUNT_0 = 12;

    // transaction_type: create
    // [receiver_account_id<4>|receiver_state_id<4>|token<2>]
    uint256 public constant TX_LEN_1 = 10;
    uint256 public constant MASK_TX_1 = 0xffffffffffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_ACCOUNT_1 = 4;
    uint256 public constant POSITION_STATE_1 = 8;
    uint256 public constant POSITION_TOKEN_1 = 10;

    // transaction_type: burn consent
    // [burner_state_id<4>|amount<4>]
    uint256 public constant TX_LEN_2 = 8;
    uint256 public constant MASK_TX_2 = 0xffffffffffffffffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_STATE_2 = 4;
    uint256 public constant POSITION_AMOUNT_2 = 8;

    // transaction_type: burn exec
    // [burner_state_id<4>]
    uint256 public constant TX_LEN_4 = 4;
    uint256 public constant MASK_TX_4 = 0xffffffff;
    // positions in bytes
    uint256 public constant POSITION_STATE_4 = 4;

    struct Transfer {
        uint256 fromIndex;
        uint256 toIndex;
        uint256 amount;
    }

    struct CreateAccount {
        uint256 accountID;
        uint256 stateID;
        uint256 tokenType;
    }

    struct BurnConsent {
        uint256 fromIndex;
        uint256 amount;
    }

    struct BurnExecution {
        uint256 fromIndex;
    }

    struct DropReceiver {
        uint256 receiverID;
        uint256 amount;
    }

    struct DropSender {
        uint256 accountID;
        uint256 stateID;
        uint256 nonce;
    }

    function create_serializeFromEncoded(bytes[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_1 * batchSize);
        for (uint256 i = 0; i < txs.length; i++) {
            uint256 accountID;
            uint256 stateID;
            uint256 tokenType;
            (, accountID, stateID, tokenType) = abi.decode(
                txs[i],
                (uint256, uint256, uint256, uint256)
            );
            bytes memory _tx = abi.encodePacked(
                uint32(accountID),
                uint32(stateID),
                uint16(tokenType)
            );
            uint256 off = i * TX_LEN_1;
            for (uint256 j = 0; j < TX_LEN_1; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(Types.CreateAccount[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_0 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 accountID = txs[i].accountID;
            uint256 stateID = txs[i].stateID;
            uint256 tokenType = txs[i].tokenType;
            bytes memory _tx = abi.encodePacked(
                uint32(accountID),
                uint32(stateID),
                uint16(tokenType)
            );
            uint256 off = i * TX_LEN_0;
            for (uint256 j = 0; j < TX_LEN_0; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(CreateAccount[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;

        bytes memory serialized = new bytes(TX_LEN_1 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 accountID = txs[i].accountID;
            uint256 stateID = txs[i].stateID;
            uint256 tokenType = txs[i].tokenType;
            bytes memory _tx = abi.encodePacked(
                uint32(accountID),
                uint32(stateID),
                uint16(tokenType)
            );
            uint256 off = i * TX_LEN_1;
            for (uint256 j = 0; j < TX_LEN_1; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function create_decode(bytes memory txs, uint256 index)
        internal
        pure
        returns (CreateAccount memory _tx)
    {
        uint256 accountID;
        uint256 stateID;
        uint256 tokenType;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            accountID := and(
                mload(add(p_tx, POSITION_ACCOUNT_1)),
                MASK_ACCOUNT_ID
            )
            stateID := and(mload(add(p_tx, POSITION_STATE_1)), MASK_STATE_ID)
            tokenType := and(mload(add(p_tx, POSITION_TOKEN_1)), MASK_TOKEN_ID)
        }
        return CreateAccount(accountID, stateID, tokenType);
    }

    function create_hasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_1 != 0;
    }

    function create_size(bytes memory txs) internal pure returns (uint256) {
        return txs.length / TX_LEN_1;
    }

    function create_accountIdOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            receiver := and(mload(add(p_tx, POSITION_ACCOUNT_1)), MASK_STATE_ID)
        }
    }

    function create_stateIdOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 state)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            state := and(mload(add(p_tx, POSITION_STATE_1)), MASK_STATE_ID)
        }
    }

    function create_tokenOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 tokenType)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            tokenType := and(mload(add(p_tx, POSITION_TOKEN_1)), MASK_TOKEN_ID)
        }
        return tokenType;
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

    function transfer_encodedFromBytes(bytes memory txBytes)
        internal
        pure
        returns (Types.Transfer memory)
    {
        Types.Transfer memory _tx;
        (
            _tx.txType,
            _tx.fromIndex,
            _tx.toIndex,
            _tx.tokenType,
            _tx.nonce,
            _tx.amount
        ) = abi.decode(
            txBytes,
            (uint256, uint256, uint256, uint256, uint256, uint256)
        );
        return _tx;
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
            (, fromIndex, toIndex, , , amount) = abi.decode(
                txs[i],
                (uint256, uint256, uint256, uint256, uint256, uint256)
            );
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(amount)
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
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(amount)
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
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(toIndex),
                uint32(amount)
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
                    uint32(txs[i].amount)
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
        bytes memory signature = new bytes(65);
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            sender := and(mload(add(p_tx, POSITION_SENDER_0)), MASK_STATE_ID)
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_0)),
                MASK_STATE_ID
            )
            amount := and(mload(add(p_tx, POSITION_AMOUNT_0)), MASK_AMOUNT)
        }
        return Transfer(sender, receiver, amount);
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
        return amount;
    }

    // Burn Consent

    function burnConsent_serializeFromEncoded(bytes[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_2 * batchSize);
        for (uint256 i = 0; i < txs.length; i++) {
            uint256 fromIndex;
            uint256 amount;
            (, fromIndex, amount, ) = abi.decode(
                txs[i],
                (uint256, uint256, uint256, uint256)
            );
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(amount)
            );
            uint256 off = i * TX_LEN_2;
            for (uint256 j = 0; j < TX_LEN_2; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(Types.BurnConsent[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_2 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            uint256 amount = txs[i].amount;
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(amount)
            );
            uint256 off = i * TX_LEN_2;
            for (uint256 j = 0; j < TX_LEN_2; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(BurnConsent[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;

        bytes memory serialized = new bytes(TX_LEN_2 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            uint256 amount = txs[i].amount;
            bytes memory _tx = abi.encodePacked(
                uint32(fromIndex),
                uint32(amount)
            );
            uint256 off = i * TX_LEN_2;
            for (uint256 j = 0; j < TX_LEN_2; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function burnConsent_decode(bytes memory txs, uint256 index)
        internal
        pure
        returns (BurnConsent memory _tx)
    {
        uint256 fromIndex;
        uint256 amount;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_2))
            fromIndex := and(mload(add(p_tx, POSITION_STATE_2)), MASK_STATE_ID)
            amount := and(mload(add(p_tx, POSITION_AMOUNT_2)), MASK_AMOUNT)
        }
        return BurnConsent(fromIndex, amount);
    }

    function burnConsent_hasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_2 != 0;
    }

    function burnConsent_size(bytes memory txs)
        internal
        pure
        returns (uint256)
    {
        return txs.length / TX_LEN_2;
    }

    function burnConsent_fromIndexOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 sender)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_2))
            sender := and(mload(add(p_tx, POSITION_STATE_2)), MASK_STATE_ID)
        }
    }

    function burnConsent_amountOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 amount)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_2))
            amount := and(mload(add(p_tx, POSITION_AMOUNT_2)), MASK_AMOUNT)
        }
        return amount;
    }

    function burnExecution_serializeFromEncoded(bytes[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_4 * batchSize);
        for (uint256 i = 0; i < txs.length; i++) {
            uint256 fromIndex;
            (, fromIndex) = abi.decode(txs[i], (uint256, uint256));
            bytes memory _tx = abi.encodePacked(uint32(fromIndex));
            uint256 off = i * TX_LEN_4;
            for (uint256 j = 0; j < TX_LEN_4; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(Types.BurnExecution[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;

        bytes memory serialized = new bytes(TX_LEN_4 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            bytes memory _tx = abi.encodePacked(uint32(fromIndex));
            uint256 off = i * TX_LEN_4;
            for (uint256 j = 0; j < TX_LEN_4; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function serialize(BurnExecution[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;

        bytes memory serialized = new bytes(TX_LEN_4 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 fromIndex = txs[i].fromIndex;
            bytes memory _tx = abi.encodePacked(uint32(fromIndex));
            uint256 off = i * TX_LEN_4;
            for (uint256 j = 0; j < TX_LEN_4; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function burnExecution_hasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_4 != 0;
    }

    function burnExecution_size(bytes memory txs)
        internal
        pure
        returns (uint256)
    {
        return txs.length / TX_LEN_4;
    }

    function burnExecution_fromIndexOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 sender)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_4))
            sender := and(mload(add(p_tx, POSITION_STATE_4)), MASK_STATE_ID)
        }
    }

    function burnExecution_hashOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (bytes32 result)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_4), 32))
            result := keccak256(p_tx, TX_LEN_4)
        }
    }

    function burnExecution_toLeafs(bytes memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = burnExecution_size(txs);
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = burnExecution_hashOf(txs, i);
        }
        return buf;
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

    function airdrop_messageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce
    ) internal pure returns (bytes32) {
        Transfer memory _tx = transfer_decode(txs, index);
        return
            keccak256(
                abi.encodePacked(
                    AIRDROP,
                    _tx.fromIndex,
                    _tx.toIndex,
                    nonce,
                    _tx.amount
                )
            );
    }

    function create_hashOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (bytes32 result)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_1), 32))
            result := keccak256(p_tx, TX_LEN_1)
        }
    }

    function create_toLeafs(bytes memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = create_size(txs);
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = create_hashOf(txs, i);
        }
        return buf;
    }

    function burnConsent_hashOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (bytes32 result)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_2), 32))
            result := keccak256(p_tx, TX_LEN_2)
        }
    }

    function burnConsent_toLeafs(bytes memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = burnConsent_size(txs);
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = burnConsent_hashOf(txs, i);
        }
        return buf;
    }

    function burnConsent_messageOf(
        bytes memory txs,
        uint256 index,
        uint256 nonce
    ) internal pure returns (bytes32) {
        BurnConsent memory _tx = burnConsent_decode(txs, index);
        return
            keccak256(
                abi.encodePacked(BURN_CONCENT, _tx.fromIndex, nonce, _tx.amount)
            );
    }
}
