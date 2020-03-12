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
        uint balance;
        uint tokenType;
        uint nonce;
    }

    // account leaf also contains the path to the account from the root
    struct AccountLeaf{
        uint path;
        uint balance;
        uint tokenType;
        uint nonce;
    }

    struct DepositLeaf{
        string pubkey;
    }

    struct Transaction{
        Account from;
        Account to;
        uint tokenType;
        uint32 amount;
        bytes signature;
    }

    struct MerkleProof{
        AccountLeaf account;
        bytes32[] siblings;
    }
}
