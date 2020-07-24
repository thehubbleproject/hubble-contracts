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

export const DummyPDA: PDALeaf = {
    pubkey: "0x1aaa2aaa3aaa4aaa5aaa6aaa7aaa8aaa9aaa10aa11aa12aa13aa14aa15aa16aa"
};

export const coordinatorPubkeyHash =
    "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";

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
