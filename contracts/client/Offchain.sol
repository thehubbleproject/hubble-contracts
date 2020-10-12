pragma solidity ^0.5.15;

/**
    @notice types defined here are passing between users and the client, but not on chain.
 */
library Offchain {
    struct Transfer {
        uint256 txType;
        uint256 fromIndex;
        uint256 toIndex;
        uint256 nonce;
        uint256 amount;
        uint256 fee;
    }

    struct Create2Transfer {
        uint256 txType;
        uint256 fromIndex;
        uint256 toIndex;
        uint256 toAccID;
        uint256 nonce;
        uint256 amount;
        uint256 fee;
    }
}
