pragma solidity ^0.5.15;

/**
 * @title DataTypes
 */
library Types {
    struct SignatureProof {
        Types.UserAccount[] stateAccounts;
        bytes32[][] stateWitnesses;
        uint256[4][] pubkeys;
        bytes32[][] pubkeyWitnesses;
    }

    // We define Usage for a batch or for a tx
    // to check if the usage of a batch and all txs in it are the same
    enum Usage {
        Genesis, // The Genesis type is only applicable to batch but not tx
        Transfer,
        CreateAccount,
        Airdrop,
        BurnConsent,
        BurnExecution,
        // Only applicable to batch and not tx
        Deposit
    }

    // Batch represents the batch submitted periodically to the ethereum chain
    struct Batch {
        bytes32 commitmentRoot;
        address committer;
        uint256 finalisesOn;
        bytes32 depositRoot;
        bool withdrawn;
    }

    struct Commitment {
        bytes32 stateRoot;
        bytes32 accountRoot;
        bytes32 txHashCommitment;
        uint256[2] signature;
        Usage batchType;
    }

    struct CommitmentInclusionProof {
        Commitment commitment;
        uint256 pathToCommitment;
        bytes32[] witness;
    }

    // Transaction represents how each transaction looks like for
    // this rollup chain
    struct Transfer {
        uint256 txType;
        uint256 fromIndex;
        uint256 toIndex;
        uint256 tokenType;
        uint256 nonce;
        uint256 amount;
        uint256 fee;
    }

    struct CreateAccount {
        uint256 txType;
        uint256 accountID;
        uint256 stateID;
        uint256 tokenType;
    }

    struct DropTx {
        uint256 txType;
        uint256 fromIndex;
        uint256 toIndex;
        uint256 tokenType;
        uint256 nonce;
        uint256 amount;
        bytes signature;
    }

    struct BurnConsent {
        uint256 txType;
        uint256 fromIndex;
        uint256 amount;
        uint256 nonce;
    }

    struct BurnExecution {
        uint256 txType;
        uint256 fromIndex;
    }

    // AccountInclusionProof consists of the following fields
    // 1. Path to the account leaf from root in the balances tree
    // 2. Actual data stored in the leaf
    struct AccountInclusionProof {
        uint256 pathToAccount;
        UserAccount account;
    }

    struct TranasctionInclusionProof {
        uint256 pathToTx;
        Transfer data;
    }

    // UserAccount contains the actual data stored in the leaf of balance tree
    struct UserAccount {
        // ID is the path to the pubkey in the PDA tree
        uint256 ID;
        uint256 tokenType;
        uint256 balance;
        uint256 nonce;
        uint256 burn;
        uint256 lastBurn;
    }

    struct AccountMerkleProof {
        AccountInclusionProof accountIP;
        bytes32[] siblings;
    }

    struct AccountProofs {
        AccountMerkleProof from;
        AccountMerkleProof to;
    }

    struct BatchValidationProofs {
        AccountProofs[] accountProofs;
    }

    struct TransactionMerkleProof {
        TranasctionInclusionProof _tx;
        bytes32[] siblings;
    }

    enum ErrorCode {
        NoError,
        InvalidTokenAddress,
        InvalidTokenAmount,
        NotEnoughTokenBalance,
        BadFromTokenType,
        BadToTokenType,
        BadFromIndex,
        BurnAlreadyExecuted,
        NotOnDesignatedStateLeaf,
        NotCreatingOnZeroAccount,
        BadSignature
    }
}
