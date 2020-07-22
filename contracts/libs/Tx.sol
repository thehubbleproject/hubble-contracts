pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {BLS} from "./BLS.sol";

library Tx {
    uint256 public constant MASK_ACCOUNT_ID = 0xffffffff;
    uint256 public constant MASK_STATE_ID = 0xffffffff;
    uint256 public constant MASK_AMOUNT = 0xffffffff;
    uint256 public constant MASK_NONCE = 0xffffffff;
    uint256 public constant MASK_TOKEN_ID = 0xffff;
    uint256 public constant MASK_BYTE = 0xff;

    uint256 constant bound4Bytes = 0x10000000000000000;
    uint256 constant bound2Bytes = 0x100000000;
    uint256 constant bound1Bytes = 0x10000;

    // transaction_type: transfer
    // [sender_state_id<4>|receiver_state_id<4>|amount<4>|nonce<4>]
    uint256 public constant TX_LEN_0 = 16;
    uint256 public constant MASK_TX_0 = 0xffffffffffffffffffffffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_SENDER_0 = 4;
    uint256 public constant POSITION_RECEIVER_0 = 8;
    uint256 public constant POSITION_AMOUNT_0 = 12;
    uint256 public constant POSITION_NONCE_0 = 16;

    // transaction_type: create
    // [receiver_account_id<4>|receiver_state_id<4>|token<2>]
    uint256 public constant TX_LEN_1 = 10;
    uint256 public constant MASK_TX_1 = 0xffffffffffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_ACCOUNT_1 = 4;
    uint256 public constant POSITION_STATE_1 = 8;
    uint256 public constant POSITION_TOKEN_1 = 10;

    // transaction_type: burn concent
    // [burner_state_id<4>|amount<4>|nonce<4>|sign<1>]
    uint256 public constant TX_LEN_2 = 13;
    uint256 public constant MASK_TX_2 = 0xffffffffffffffffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_STATE_2 = 4;
    uint256 public constant POSITION_AMOUNT_2 = 8;
    uint256 public constant POSITION_NONCE_2 = 12;
    uint256 public constant POSITION_SIGN_2 = 13;

    // transaction_type: airdrop_reciver_side
    // [receiver_state_id<4>|amount<4>]
    uint256 public constant TX_LEN_3a = 8;
    uint256 public constant MASK_TX_3a = 0xffffffff;
    // positions in bytes
    uint256 public constant POSITION_RECEIVER_3a = 4;
    uint256 public constant POSITION_AMOUNT_3a = 8;

    // transaction_type: airdrop_sender_side
    // [sender_account_id<4>|sender_state_id<4>|nonce<4>]
    uint256 public constant TX_LEN_3b = 12;
    uint256 public constant MASK_TX_3b = 0xffffffffffff;
    // positions in bytes
    uint256 public constant POSITION_STATE_3b = 4;
    uint256 public constant POSITION_ACCOUNT_3b = 8;
    uint256 public constant POSITION_NONCE_3b = 12;

    struct TransferDecoded {
        uint256 senderID;
        uint256 receiverID;
        uint256 amount;
        uint256 nonce;
    }

    struct CreateDecoded {
        uint256 accountID;
        uint256 stateID;
        uint256 token;
    }

    struct BurnConcentDecoded {
        uint256 stateID;
        uint256 amount;
        uint256 nonce;
        bool sign;
    }

    struct DropDecodedReceiver {
        uint256 receiverID;
        uint256 amount;
    }

    struct DropDecodedSender {
        uint256 senderID;
        uint256 nonce;
    }

    function serialize(TransferDecoded[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;
        bytes memory serialized = new bytes(TX_LEN_0 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 sender = txs[i].senderID;
            uint256 receiver = txs[i].receiverID;
            uint256 amount = txs[i].amount;
            uint256 nonce = txs[i].nonce;
            require(sender < bound4Bytes, "invalid senderID");
            require(receiver < bound4Bytes, "invalid receiverID");
            require(amount < bound4Bytes, "invalid amount");
            require(nonce < bound4Bytes, "invalid nonce");
            bytes memory _tx = abi.encodePacked(
                uint32(sender),
                uint32(receiver),
                uint32(amount),
                uint32(nonce)
            );
            uint256 off = i * TX_LEN_0;
            for (uint256 j = 0; j < TX_LEN_0; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function transfer_decodedToLeafs(TransferDecoded[] memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = txs.length;
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = keccak256(
                abi.encodePacked(
                    uint32(txs[i].senderID),
                    uint32(txs[i].receiverID),
                    uint32(txs[i].amount),
                    uint32(txs[i].nonce)
                )
            );
        }
        return buf;
    }

    function transfer_decode(bytes memory txs, uint256 index)
        internal
        pure
        returns (
            uint256 sender,
            uint256 receiver,
            uint256 amount,
            uint256 nonce
        )
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            sender := and(mload(add(p_tx, POSITION_SENDER_0)), MASK_STATE_ID)
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_0)),
                MASK_STATE_ID
            )
            amount := and(mload(add(p_tx, POSITION_AMOUNT_0)), MASK_AMOUNT)
            nonce := and(mload(add(p_tx, POSITION_NONCE_0)), MASK_STATE_ID)
        }
    }

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

    function transfer_senderOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 sender)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            sender := and(mload(add(p_tx, POSITION_SENDER_0)), MASK_STATE_ID)
        }
    }

    function transfer_receiverOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_0)),
                MASK_STATE_ID
            )
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

    function transfer_nonceOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 nonce)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_0))
            nonce := and(mload(add(p_tx, POSITION_NONCE_0)), MASK_STATE_ID)
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

    function transfer_mapToPoint(bytes memory txs, uint256 index)
        internal
        view
        returns (uint256[2] memory)
    {
        bytes32 r;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_0), 32))
            r := keccak256(p_tx, TX_LEN_0)
        }
        return BLS.mapToPoint(r);
    }

    function serialize(CreateDecoded[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;

        bytes memory serialized = new bytes(TX_LEN_1 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 accountID = txs[i].accountID;
            uint256 stateID = txs[i].stateID;
            uint256 token = txs[i].token;
            require(accountID < bound4Bytes, "invalid accountID");
            require(stateID < bound4Bytes, "invalid stateID");
            require(token < bound2Bytes, "invalid amount");
            bytes memory _tx = abi.encodePacked(
                uint32(accountID),
                uint32(stateID),
                uint16(token)
            );
            uint256 off = i * TX_LEN_1;
            for (uint256 j = 0; j < TX_LEN_1; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
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
        returns (uint256 sender)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            sender := and(mload(add(p_tx, POSITION_STATE_1)), MASK_STATE_ID)
        }
    }

    function create_tokenOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 amount)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_1))
            amount := and(mload(add(p_tx, POSITION_TOKEN_1)), MASK_TOKEN_ID)
        }
        return amount;
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

    function serialize(BurnConcentDecoded[] memory txs)
        internal
        pure
        returns (bytes memory)
    {
        uint256 batchSize = txs.length;

        bytes memory serialized = new bytes(TX_LEN_2 * batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 stateID = txs[i].stateID;
            uint256 amount = txs[i].amount;
            uint256 nonce = txs[i].nonce;
            bool sign = txs[i].sign;
            require(stateID < bound4Bytes, "invalid stateID");
            require(amount < bound4Bytes, "invalid amount");
            require(nonce < bound4Bytes, "invalid nonce");
            // require(sign < 2, "invalid sign");
            bytes memory _tx = abi.encodePacked(
                uint32(stateID),
                uint32(amount),
                uint32(nonce),
                sign
            );
            require(_tx.length == TX_LEN_2, "TODO: rm, bad implementation");
            uint256 off = i * TX_LEN_2;
            for (uint256 j = 0; j < TX_LEN_2; j++) {
                serialized[j + off] = _tx[j];
            }
        }
        return serialized;
    }

    function burnConcent_hasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return txs.length % TX_LEN_2 != 0;
    }

    function burnConcent_size(bytes memory txs)
        internal
        pure
        returns (uint256)
    {
        return txs.length / TX_LEN_2;
    }

    function burnConcent_stateIdOf(bytes memory txs, uint256 index)
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

    function burnConcent_amountOf(bytes memory txs, uint256 index)
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

    function burnConcent_nonceOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_2))
            receiver := and(mload(add(p_tx, POSITION_NONCE_2)), MASK_STATE_ID)
        }
    }

    function burnConcent_signOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (bool sign)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, mul(index, TX_LEN_2))
            sign := and(mload(add(p_tx, POSITION_SIGN_2)), MASK_BYTE)
        }
    }

    function burnConcent_hashOf(bytes memory txs, uint256 index)
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

    function burnConcent_toLeafs(bytes memory txs)
        internal
        pure
        returns (bytes32[] memory)
    {
        uint256 batchSize = burnConcent_size(txs);
        bytes32[] memory buf = new bytes32[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            buf[i] = burnConcent_hashOf(txs, i);
        }
        return buf;
    }

    function burnConcent_mapToPoint(bytes memory txs, uint256 index)
        internal
        view
        returns (uint256[2] memory)
    {
        bytes32 r;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_2), 32))
            r := keccak256(p_tx, TX_LEN_2)
        }
        return BLS.mapToPoint(r);
    }

    function serialize(
        DropDecodedSender memory stx,
        DropDecodedReceiver[] memory rtxs
    ) internal pure returns (bytes memory) {
        uint256 batchSize = rtxs.length;

        bytes memory serialized = new bytes(TX_LEN_3a * batchSize + TX_LEN_3b);
        uint256 stateID = stx.senderID;
        uint256 nonce = stx.nonce;
        require(stateID < bound4Bytes, "invalid stateID");
        require(nonce < bound4Bytes, "invalid nonce");
        bytes memory _tx = abi.encodePacked(uint32(stateID), uint32(nonce));
        for (uint256 j = 0; j < TX_LEN_3b; j++) {
            serialized[j] = _tx[j];
        }
        uint256 off = TX_LEN_3b;
        for (uint256 i = 0; i < batchSize; i++) {
            stateID = rtxs[i].receiverID;
            uint256 amount = rtxs[i].amount;
            require(stateID < bound4Bytes, "invalid stateID");
            require(amount < bound4Bytes, "invalid amount");
            _tx = abi.encodePacked(uint32(stateID), uint32(amount));
            for (uint256 j = 0; j < TX_LEN_3a; j++) {
                serialized[j + off] = _tx[j];
            }
            off += TX_LEN_3a;
        }
        return serialized;
    }

    function airdrop_decode(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 receiver, uint256 amount)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_3a), TX_LEN_3b))
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_3a)),
                MASK_STATE_ID
            )
            amount := and(mload(add(p_tx, POSITION_AMOUNT_3a)), MASK_AMOUNT)
        }
    }

    function airdrop_hasExcessData(bytes memory txs)
        internal
        pure
        returns (bool)
    {
        return (txs.length - TX_LEN_3b) % TX_LEN_3a != 0;
    }

    function airdrop_size(bytes memory txs) internal pure returns (uint256) {
        return (txs.length - TX_LEN_3b) / TX_LEN_3a;
    }

    function airdrop_senderAccountID(bytes memory txs)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            receiver := and(
                mload(add(txs, POSITION_ACCOUNT_3b)),
                MASK_ACCOUNT_ID
            )
        }
    }

    function airdrop_senderStateID(bytes memory txs)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            receiver := and(mload(add(txs, POSITION_STATE_3b)), MASK_STATE_ID)
        }
    }

    function airdrop_nonce(bytes memory txs)
        internal
        pure
        returns (uint256 nonce)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            nonce := and(mload(add(txs, POSITION_NONCE_3b)), MASK_STATE_ID)
        }
    }

    function airdrop_receiverOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 receiver)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_3a), TX_LEN_3b))
            receiver := and(
                mload(add(p_tx, POSITION_RECEIVER_3a)),
                MASK_STATE_ID
            )
        }
    }

    function airdrop_amountOf(bytes memory txs, uint256 index)
        internal
        pure
        returns (uint256 amount)
    {
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            let p_tx := add(txs, add(mul(index, TX_LEN_3a), TX_LEN_3b))
            amount := and(mload(add(p_tx, POSITION_AMOUNT_3a)), MASK_AMOUNT)
        }
        return amount;
    }
}
