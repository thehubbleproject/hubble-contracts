"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountRegistry = void 0;
const tree_1 = require("./tree");
const ethers_1 = require("ethers");
const chai_1 = require("chai");
class AccountRegistry {
    constructor(registry, depth, batchDepth) {
        this.registry = registry;
        this.depth = depth;
        this.batchDepth = batchDepth;
        // TODO: must be big int
        this.leftIndex = 0;
        this.rigthIndex = 0;
        this.treeLeft = tree_1.Tree.new(depth);
        this.treeRight = tree_1.Tree.new(depth);
        this.setSize = 1 << depth;
    }
    static async new(registry) {
        const depth = (await registry.DEPTH()).toNumber();
        const batchDepth = (await registry.BATCH_DEPTH()).toNumber();
        return new AccountRegistry(registry, depth, batchDepth);
    }
    async register(pubkey) {
        const accountID = (await this.registry.leafIndexLeft()).toNumber();
        await (await this.registry.register(pubkey)).wait();
        const leaf = this.pubkeyToLeaf(pubkey);
        this.treeLeft.updateSingle(accountID, leaf);
        const _witness = this.witness(accountID);
        chai_1.assert.isTrue(await this.registry.exists(accountID, pubkey, _witness.slice(0, 31)));
        return accountID;
    }
    witness(accountID) {
        // TODO: from right
        const witness = this.treeLeft.witness(accountID).nodes;
        witness.push(this.treeRight.root);
        return witness;
    }
    root() {
        const hasher = this.treeLeft.hasher;
        return hasher.hash2(this.treeLeft.root, this.treeRight.root);
    }
    pubkeyToLeaf(uncompressed) {
        const leaf = ethers_1.ethers.utils.solidityKeccak256(["uint256", "uint256", "uint256", "uint256"], uncompressed);
        return leaf;
    }
}
exports.AccountRegistry = AccountRegistry;
//# sourceMappingURL=accountTree.js.map