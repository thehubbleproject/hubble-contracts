"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TestAccountTreeFactory_1 = require("../types/ethers-contracts/TestAccountTreeFactory");
const tree_1 = require("../ts/tree");
const buidler_1 = require("@nomiclabs/buidler");
const chai_1 = require("chai");
const utils_1 = require("../ts/utils");
let DEPTH;
let BATCH_DEPTH;
describe("Account Tree", async () => {
    let accountTree;
    let treeLeft;
    let treeRight;
    let hasher;
    beforeEach(async function () {
        const accounts = await buidler_1.ethers.getSigners();
        accountTree = await new TestAccountTreeFactory_1.TestAccountTreeFactory(accounts[0]).deploy();
        DEPTH = (await accountTree.DEPTH()).toNumber();
        BATCH_DEPTH = (await accountTree.BATCH_DEPTH()).toNumber();
        treeLeft = tree_1.Tree.new(DEPTH);
        treeRight = tree_1.Tree.new(DEPTH);
        hasher = treeLeft.hasher;
    });
    it("empty tree construction", async function () {
        for (let i = 0; i < DEPTH; i++) {
            const zi = await accountTree.zeros(i);
            const fstLeft = await accountTree.filledSubtreesLeft(i);
            chai_1.assert.equal(treeLeft.zeros[DEPTH - i], zi);
            chai_1.assert.equal(fstLeft, zi);
            if (i < DEPTH - BATCH_DEPTH) {
                const zi = await accountTree.zeros(i + BATCH_DEPTH);
                const fstRight = await accountTree.filledSubtreesRight(i);
                chai_1.assert.equal(treeRight.zeros[DEPTH - i - BATCH_DEPTH], zi);
                chai_1.assert.equal(fstRight, zi);
            }
        }
        chai_1.assert.equal(treeLeft.root, await accountTree.rootLeft());
        chai_1.assert.equal(treeRight.root, await accountTree.rootRight());
        const root = hasher.hash2(treeLeft.root, treeRight.root);
        chai_1.assert.equal(root, await accountTree.root());
    });
    it("update with single leaf", async function () {
        for (let i = 0; i < 33; i++) {
            const leaf = utils_1.randHex(32);
            treeLeft.updateSingle(i, leaf);
            await accountTree.updateSingle(leaf);
            chai_1.assert.equal(treeLeft.root, await accountTree.rootLeft());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            chai_1.assert.equal(root, await accountTree.root());
        }
    });
    it("batch update", async function () {
        const batchSize = 1 << BATCH_DEPTH;
        for (let k = 0; k < 4; k++) {
            const leafs = utils_1.randomLeaves(batchSize);
            treeRight.updateBatch(batchSize * k, leafs);
            await accountTree.updateBatch(leafs);
            chai_1.assert.equal(treeRight.root, await accountTree.rootRight());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            chai_1.assert.equal(root, await accountTree.root());
        }
    }).timeout(50000);
    it("witness for left side", async function () {
        let leafs = utils_1.randomLeaves(16);
        for (let i = 0; i < leafs.length; i++) {
            treeLeft.updateSingle(i, leafs[i]);
            await accountTree.updateSingle(leafs[i]);
        }
        for (let i = 0; i < 16; i++) {
            let leafIndex = i;
            let leaf = leafs[i];
            let witness = treeLeft.witness(i).nodes;
            const { 1: result } = await accountTree.callStatic.checkInclusion(leaf, leafIndex, witness);
            chai_1.assert.isTrue(result);
        }
    });
    it("witness for right side", async function () {
        const batchSize = 1 << BATCH_DEPTH;
        const leafs = utils_1.randomLeaves(batchSize);
        treeRight.updateBatch(0, leafs);
        await accountTree.updateBatch(leafs);
        let offset = buidler_1.ethers.BigNumber.from(2).pow(buidler_1.ethers.BigNumber.from(DEPTH));
        for (let i = 0; i < batchSize; i += 41) {
            const leafIndex = offset.add(i);
            let leaf = leafs[i];
            let witness = treeRight.witness(i).nodes;
            let { 1: result } = await accountTree.callStatic.checkInclusion(leaf, leafIndex, witness);
            chai_1.assert.isTrue(result);
        }
    });
    it("gas cost: update tree single", async function () {
        const leaf = buidler_1.ethers.utils.randomBytes(32);
        const gasCost = await accountTree.callStatic.updateSingle(leaf);
        console.log(gasCost.toNumber());
    });
    it("gas cost: update tree batch", async function () {
        const leafs = utils_1.randomLeaves(1 << BATCH_DEPTH);
        const gasCost = await accountTree.callStatic.updateBatch(leafs);
        console.log(gasCost.toNumber());
    });
});
//# sourceMappingURL=accountTree.test.js.map