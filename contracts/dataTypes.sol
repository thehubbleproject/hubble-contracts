pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

/**
 * @title DataTypes
 * @notice TODO
 */
contract DataTypes {
    // Batch
    struct Batch{
        bytes32 stateRoot;
        bytes32 withdraw_root;
        address committer;
        bytes32 account_tree_state;
        bytes32 txRoot;
        uint timestamp;
    }

    // Account or leaf structure
    struct Account{
        uint path;
        uint balance;
        uint tokenType;
        uint nonce;
    }

    struct Transaction{
        Account from;
        Account to;
        uint tokenType;
        uint32 amount;
        bytes signature;
    }

    struct MerkleProof{
        Account account;
        bytes32[] siblings;
    }
}
