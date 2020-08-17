import { Tree } from "./tree";
import { BlsAccountRegistryInstance } from "../../types/truffle-contracts";
import { BlsAccountRegistry } from "../../types/ethers-contracts/BlsAccountRegistry";
import { ethers } from "ethers";

export class AccountRegistry {
    treeLeft: Tree;
    treeRight: Tree;
    // TODO: must be big int
    leftIndex: number = 0;
    rigthIndex: number = 0;
    setSize: number;

    public static async new(
        registry: BlsAccountRegistryInstance
    ): Promise<AccountRegistry> {
        const depth = (await registry.DEPTH()).toNumber();
        const batchDepth = (await registry.BATCH_DEPTH()).toNumber();
        return new AccountRegistry(registry, depth, batchDepth);
    }
    constructor(
        private readonly registry: BlsAccountRegistryInstance,
        private readonly depth: number,
        private readonly batchDepth: number
    ) {
        this.treeLeft = Tree.new(depth);
        this.treeRight = Tree.new(depth);
        this.setSize = 1 << depth;
    }

    public async register(pubkey: string[]): Promise<number> {
        const accountID = (await this.registry.leafIndexLeft()).toNumber();
        await this.registry.register(pubkey);
        const leaf = this.pubkeyToLeaf(pubkey);
        this.treeLeft.updateSingle(accountID, leaf);
        const _witness = this.witness(accountID);
        assert.isTrue(
            await this.registry.exists(accountID, pubkey, _witness.slice(0, 31))
        );
        return accountID;
    }

    public witness(accountID: number): string[] {
        // TODO: from right
        const witness = this.treeLeft.witness(accountID).nodes;
        witness.push(this.treeRight.root);
        return witness;
    }

    public root() {
        const hasher = this.treeLeft.hasher;
        return hasher.hash2(this.treeLeft.root, this.treeRight.root);
    }

    public pubkeyToLeaf(uncompressed: string[]) {
        const leaf = ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            uncompressed
        );
        return leaf;
    }
}

export class AccountRegistry2 {
    treeLeft: Tree;
    treeRight: Tree;
    // TODO: must be big int
    leftIndex: number = 0;
    rigthIndex: number = 0;
    setSize: number;

    public static async new(
        registry: BlsAccountRegistry
    ): Promise<AccountRegistry2> {
        const depth = (await registry.DEPTH()).toNumber();
        const batchDepth = (await registry.BATCH_DEPTH()).toNumber();
        return new AccountRegistry2(registry, depth, batchDepth);
    }
    constructor(
        public readonly registry: BlsAccountRegistry,
        private readonly depth: number,
        private readonly batchDepth: number
    ) {
        this.treeLeft = Tree.new(depth);
        this.treeRight = Tree.new(depth);
        this.setSize = 1 << depth;
    }

    public async register(pubkey: string[]): Promise<number> {
        const accountID = (await this.registry.leafIndexLeft()).toNumber();
        await (await this.registry.register(pubkey)).wait();
        const leaf = this.pubkeyToLeaf(pubkey);
        this.treeLeft.updateSingle(accountID, leaf);
        const _witness = this.witness(accountID);
        assert.isTrue(
            await this.registry.exists(accountID, pubkey, _witness.slice(0, 31))
        );
        return accountID;
    }

    public witness(accountID: number): string[] {
        // TODO: from right
        const witness = this.treeLeft.witness(accountID).nodes;
        witness.push(this.treeRight.root);
        return witness;
    }

    public root() {
        const hasher = this.treeLeft.hasher;
        return hasher.hash2(this.treeLeft.root, this.treeRight.root);
    }

    public pubkeyToLeaf(uncompressed: string[]) {
        const leaf = ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            uncompressed
        );
        return leaf;
    }
}
