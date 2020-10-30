pragma solidity ^0.5.15;

/**
 * @title DataTypes
 */
library Types {
    // prettier-ignore
    uint256 public constant ADDRESS_MASK = 0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff;
    struct SignatureProof {
        Types.UserState[] states;
        bytes32[][] stateWitnesses;
        uint256[4][] pubkeys;
        bytes32[][] pubkeyWitnesses;
    }
    struct SignatureProofWithReceiver {
        Types.UserState[] states;
        bytes32[][] stateWitnesses;
        uint256[4][] pubkeysSender;
        bytes32[][] pubkeyWitnessesSender;
        uint256[4][] pubkeysReceiver;
        bytes32[][] pubkeyWitnessesReceiver;
    }

    // We define Usage for a batch or for a tx
    // to check if the usage of a batch and all txs in it are the same
    enum Usage {
        Genesis, // The Genesis type is only applicable to batch but not tx
        Transfer,
        MassMigration,
        Create2Transfer,
        // Only applicable to batch and not tx
        Deposit
    }

    // Batch represents the batch submitted periodically to the ethereum chain
    struct Batch {
        bytes32 commitmentRoot;
        // [...|batchType<1>|commitmentLength<1>|committer<20>|finaliseOn<4>]
        bytes32 meta;
    }

    function encodeMeta(
        uint256 batchType,
        uint256 size,
        address committer,
        uint256 finaliseOn
    ) internal pure returns (bytes32) {
        uint256 meta = 0;
        assembly {
            meta := or(shl(248, and(batchType, 0xff)), meta)
            meta := or(shl(240, and(size, 0xff)), meta)
            meta := or(
                shl(
                    80,
                    and(committer, 0xffffffffffffffffffffffffffffffffffffffff)
                ),
                meta
            )
            meta := or(shl(48, and(finaliseOn, 0xffffffff)), meta)
        }
        return bytes32(meta);
    }

    function batchType(Batch memory batch) internal pure returns (uint256) {
        return (uint256(batch.meta) >> 248) & 0xff;
    }

    function size(Batch memory batch) internal pure returns (uint256) {
        return (uint256(batch.meta) >> 240) & 0xff;
    }

    function committer(Batch memory batch) internal pure returns (address) {
        return address((uint256(batch.meta) >> 80) & ADDRESS_MASK);
    }

    function finaliseOn(Batch memory batch) internal pure returns (uint256) {
        return (uint256(batch.meta) >> 48) & 0xffffffff;
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
        uint256 feeReceiver;
        bytes txs;
    }

    function toHash(TransferBody memory body) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    body.accountRoot,
                    body.signature,
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
        uint256 spokeID;
        bytes32 withdrawRoot;
        uint256 tokenID;
        uint256 amount;
        uint256 feeReceiver;
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
                    body.spokeID,
                    body.withdrawRoot,
                    body.tokenID,
                    body.amount,
                    body.feeReceiver,
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
        uint256 path;
        bytes32[] witness;
    }

    struct TransferCommitmentInclusionProof {
        TransferCommitment commitment;
        uint256 path;
        bytes32[] witness;
    }

    struct MMCommitmentInclusionProof {
        MassMigrationCommitment commitment;
        uint256 path;
        bytes32[] witness;
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

    function encode(UserState memory state)
        internal
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                state.pubkeyIndex,
                state.tokenType,
                state.balance,
                state.nonce
            );
    }

    function decodeState(bytes memory encoded)
        internal
        pure
        returns (Types.UserState memory state)
    {
        (state.pubkeyIndex, state.tokenType, state.balance, state.nonce) = abi
            .decode(encoded, (uint256, uint256, uint256, uint256));
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

    struct SubtreeVacancyProof {
        uint256 depth;
        uint256 pathAtDepth;
        bytes32[] witness;
    }

    enum Result {
        Ok,
        InvalidTokenAmount,
        NotEnoughTokenBalance,
        BadFromTokenType,
        BadToTokenType,
        BadSignature,
        MismatchedAmount,
        BadWithdrawRoot,
        BadCompression,
        TooManyTx
    }
}
