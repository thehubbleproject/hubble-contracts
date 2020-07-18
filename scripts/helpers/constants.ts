import { Account, PDALeaf } from "./interfaces";


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

export const coordinatorPubkeyHash = "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";