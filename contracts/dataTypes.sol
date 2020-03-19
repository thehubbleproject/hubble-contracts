pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;


/**
 * @title DataTypes
 * @notice TODO
 */
contract DataTypes {
    // Batch
    struct Batch {
        bytes32 stateRoot;
        address committer;
        bytes32 txRoot;
        uint256 stakeCommitted;
        uint256 finalisesOn;
        uint256 timestamp;
    }

    // Account or leaf structure
    struct Account {
        uint256 balance;
        uint256 tokenType;
        uint256 nonce;
    }

    // account leaf also contains the path to the account from the root
    struct AccountLeaf {
        uint256 path;
        uint256 balance;
        uint256 tokenType;
        uint256 nonce;
    }

    struct DepositLeaf {
        string pubkey;
    }

    struct Transaction {
        Account from;
        Account to;
        uint256 tokenType;
        uint32 amount;
        bytes signature;
    }

    struct MerkleProof {
        AccountLeaf account;
        bytes32[] siblings;
    }
}
