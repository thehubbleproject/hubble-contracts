import {
    Account,
    PDALeaf,
    AccountMerkleProof,
    PDAMerkleProof
} from "./interfaces";
import { ethers } from "ethers";

export const DummyAccount: Account = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0,
    burn: 0,
    lastBurn: 0
};

export const RedditGenesisBalance = "1,000,000,000,000,000".split(",").join("");

// Must match RollupUtils.sol::GetGenesisAccounts()
export const RedditGenesisAccount: Account = {
    ID: 1,
    tokenType: 1,
    balance: RedditGenesisBalance,
    nonce: 0,
    burn: 0,
    lastBurn: 0
};

export const RedditProfile = {
    walletID: 1,
    // ethers.utils.keccak256(wallet[1].getPublicKey())
    pubkeyHash:
        "0x19a7ff246d1020ddef20f5fa96c42c56fdb78294f96b0cfa33c92bed7d75f96a"
};

export const DummyPDA: PDALeaf = {
    pubkey: "0x1aaa2aaa3aaa4aaa5aaa6aaa7aaa8aaa9aaa10aa11aa12aa13aa14aa15aa16aa"
};

export const ZERO_BYTES32 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

// ethers.utils.keccak256(ZERO_BYTES32)
export const ZERO_BYTES32_HASH =
    "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";

export const coordinatorPubkeyHash = ZERO_BYTES32_HASH;

// This is the MAX_DEPTH from contract Governance.
// We Build all merkle trees with this depth in tests
export const MAX_DEPTH = 4;

export const DummyAccountMP: AccountMerkleProof = {
    accountIP: {
        pathToAccount: "0",
        account: DummyAccount
    },
    siblings: []
};

export const DummyPDAMP: PDAMerkleProof = {
    _pda: {
        pathToPubkey: "0",
        pubkey_leaf: DummyPDA
    },
    siblings: []
};

// Reflects contract Governance::STAKE_AMOUNT()
export const StakingAmount = "0.1";

export const StakingAmountString = ethers.utils
    .parseEther(StakingAmount)
    .toString();
