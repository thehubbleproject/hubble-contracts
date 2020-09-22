pragma solidity ^0.5.15;

/**
 * @title DataTypes
 */
library Types {
    struct SignatureProof {
        Types.UserState[] stateAccounts;
        bytes32[][] stateWitnesses;
        uint256[4][] pubkeys;
        bytes32[][] pubkeyWitnesses;
    }

    // We define Usage for a batch or for a tx
    // to check if the usage of a batch and all txs in it are the same
    enum Usage {
        Genesis, // The Genesis type is only applicable to batch but not tx
        Transfer,
        MassMigration,
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
        bytes32 bodyRoot;
    }

    function toHash(Commitment memory commitment)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(commitment.stateRoot, commitment.bodyRoot)
            );
    }

    struct TransferBody {
        bytes32 accountRoot;
        uint256[2] signature;
        uint256 tokenType;
        uint256 feeReceiver;
        bytes txs;
    }

    function toHash(TransferBody memory body) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    body.accountRoot,
                    body.signature,
                    body.tokenType,
                    body.feeReceiver,
                    body.txs
                )
            );
    }

    struct TransferCommitment {
        bytes32 stateRoot;
        TransferBody body;
    }

    function toHash(TransferCommitment memory commitment)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(commitment.stateRoot, toHash(commitment.body))
            );
    }

    struct MassMigrationBody {
        bytes32 accountRoot;
        uint256[2] signature;
        uint256 targetSpokeID;
        bytes32 withdrawRoot;
        uint256 tokenID;
        uint256 amount;
        bytes txs;
    }

    function toHash(MassMigrationBody memory body)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    body.accountRoot,
                    body.signature,
                    body.targetSpokeID,
                    body.withdrawRoot,
                    body.tokenID,
                    body.amount,
                    body.txs
                )
            );
    }

    struct MassMigrationCommitment {
        bytes32 stateRoot;
        MassMigrationBody body;
    }

    function toHash(MassMigrationCommitment memory commitment)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(commitment.stateRoot, toHash(commitment.body))
            );
    }

    struct CommitmentInclusionProof {
        Commitment commitment;
        uint256 pathToCommitment;
        bytes32[] witness;
    }

    struct TransferCommitmentInclusionProof {
        TransferCommitment commitment;
        uint256 pathToCommitment;
        bytes32[] witness;
    }

    struct MMCommitmentInclusionProof {
        MassMigrationCommitment commitment;
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

    /**
    @param pubkeyIndex path to the pubkey in the PDA tree
     */
    struct UserState {
        uint256 pubkeyIndex;
        uint256 tokenType;
        uint256 balance;
        uint256 nonce;
    }

    function encode(UserState memory state) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                state.pubkeyIndex,
                state.tokenType,
                state.balance,
                state.nonce
            );
    }

    struct StateMerkleProof {
        UserState state;
        bytes32[] witness;
    }

    struct StateMerkleProofWithPath {
        UserState state;
        uint256 path;
        bytes32[] witness;
    }

    struct TransactionMerkleProof {
        Transfer _tx;
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
        NotOnDesignatedStateLeaf,
        BadSignature
    }
}
