import { Account, AccountMerkleProof, PDALeaf, PDAMerkleProof } from "./interfaces";
import {
    getZeroHash,
    getMerkleTreeUtils,
    getParentLeaf,
    CreateAccountLeaf,
    PubKeyHash
} from './utils';


interface LeafItem<T> {
    hash: string;
    data?: T;
}

abstract class AbstractStore<T> {

    items: LeafItem<T>[];
    size: number;
    level: number;

    constructor(level: number) {
        this.level = level;
        this.size = 2 ** level;
        this.items = [];
    }
    async abstract compress(element: T): Promise<string>;

    async insert(data: T): Promise<number> {
        const position = this.items.length;
        const hash = await this.compress(data);
        const item: LeafItem<T> = {
            hash, data
        };
        this.items.push(item);
        return position;
    }
    insertHash(hash: string): number {
        const position = this.items.length;
        const item: LeafItem<T> = { hash };
        this.items.push(item);
        return position;
    }

    getLeaves(): string[] {
        const leaves: string[] = [];
        const zeroHash = getZeroHash(0);
        for (let i = 0; i < this.size; i++) {
            if (i < this.items.length) {
                leaves.push(this.items[i].hash);
            } else {
                leaves.push(zeroHash);
            }
        };
        return leaves;
    }

    async getRoot(): Promise<string> {
        const merkleTreeUtilsInstance = await getMerkleTreeUtils();
        const leaves = this.getLeaves();
        const root = await merkleTreeUtilsInstance.getMerkleRootFromLeaves(leaves);
        return root;

    }
    _allBranches(): string[][] {
        const branches: string[][] = [];
        for (let i = 0; i < this.level; i++) {
            branches[i] = [];
        }
        branches[0] = this.getLeaves();
        for (let i = 1; i < this.level; i++) {
            for (let j = 0; j < 2 ** (this.level - i); j++) {
                branches[i][j] = getParentLeaf(branches[i - 1][j * 2], branches[i - 1][j * 2 + 1]);
            }
        }
        return branches;
    }
    getSubTreeSiblings(position: number, subtreeAtlevel: number): string[] {
        const siblingLength = this.level - subtreeAtlevel;
        const sibilings: string[] = [];
        const allBranches = this._allBranches();
        let currentLevelPosition = position;
        for (let i = subtreeAtlevel; i < siblingLength; i++) {
            if (currentLevelPosition % 2 == 0) {
                sibilings.push(allBranches[i][currentLevelPosition + 1]);
            } else {
                sibilings.push(allBranches[i][currentLevelPosition - 1]);
            }
            currentLevelPosition = Math.floor(currentLevelPosition / 2);
        }
        return sibilings;
    }
    getSiblings(position: number): string[] {
        return this.getSubTreeSiblings(position, 0);
    }
    positionToPath(position: number): string {
        // Convert to binary and pad 0s so that the output has length of this.level -1
        return position.toString(2).padStart(this.level, "0");
    }
}

const DummyAccount: Account = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0,
    burn: 0,
    lastBurn: 0
}

export class AccountStore extends AbstractStore<Account>{
    async compress(element: Account): Promise<string> {
        return await CreateAccountLeaf(element);
    }
    async getAccountMerkleProof(position: number): Promise<AccountMerkleProof> {
        const account: Account = this.items[position]?.data || DummyAccount;
        const siblings = this.getSiblings(position);
        const pathToAccount = this.positionToPath(position);

        return {
            accountIP: {
                pathToAccount,
                account
            },
            siblings
        }
    }
}

const DummyPDA: PDALeaf = {
    pubkey: "0x1aaa2aaa3aaa4aaa5aaa6aaa7aaa8aaa9aaa10aa11aa12aa13aa14aa15aa16aa"
}

export class PublicKeyStore extends AbstractStore<PDALeaf>{
    async compress(element: PDALeaf): Promise<string> {
        return PubKeyHash(element.pubkey);
    }
    insertPublicKey(pubkey: string) {
        const leaf: PDALeaf = {
            pubkey
        };
        return this.insert(leaf);
    }

    async getPDAMerkleProof(position: number): Promise<PDAMerkleProof> {
        const pubkey_leaf: PDALeaf = this.items[position]?.data || DummyPDA;
        const siblings = this.getSiblings(position);
        const pathToPubkey = position.toString();

        return {
            _pda: {
                pathToPubkey,
                pubkey_leaf
            },
            siblings
        }
    }
}
