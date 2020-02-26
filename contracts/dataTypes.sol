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
        address committer;
        bytes32 txRoot;
        uint timestamp;
    }

    // Account or leaf structure
    struct Account{
        bytes32 key;
        // only used when account used in Merkle Proof
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
