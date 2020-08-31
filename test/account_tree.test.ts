import { TestAccountTreeFactory } from "../types/ethers-contracts/TestAccountTreeFactory";
import { TestAccountTree } from "../types/ethers-contracts/TestAccountTree";
import { Tree, Hasher } from "./utils/tree";
import { ethers } from "@nomiclabs/buidler";
import { assert } from "chai";
import { parseEvents } from "../ts/utils";

let DEPTH: number;
let BATCH_DEPTH: number;
describe("Account Tree", async () => {
    let accountTree: TestAccountTree;
    let treeLeft: Tree;
    let treeRight: Tree;
    let hasher: Hasher;
    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        accountTree = await new TestAccountTreeFactory(accounts[0]).deploy();
        DEPTH = (await accountTree.DEPTH()).toNumber();
        BATCH_DEPTH = (await accountTree.BATCH_DEPTH()).toNumber();
        treeLeft = Tree.new(DEPTH);
        treeRight = Tree.new(DEPTH);
        hasher = treeLeft.hasher;
    });
    it("empty tree construction", async function() {
        for (let i = 0; i < DEPTH; i++) {
            const zi = await accountTree.zeros(i);
            const fstLeft = await accountTree.filledSubtreesLeft(i);
            assert.equal(treeLeft.zeros[DEPTH - i], zi);
            assert.equal(fstLeft, zi);
            if (i < DEPTH - BATCH_DEPTH) {
                const zi = await accountTree.zeros(i + BATCH_DEPTH);
                const fstRight = await accountTree.filledSubtreesRight(i);
                assert.equal(treeRight.zeros[DEPTH - i - BATCH_DEPTH], zi);
                assert.equal(fstRight, zi);
            }
        }
        assert.equal(treeLeft.root, await accountTree.rootLeft());
        assert.equal(treeRight.root, await accountTree.rootRight());
        const root = hasher.hash2(treeLeft.root, treeRight.root);
        assert.equal(root, await accountTree.root());
    });
    it("update with single leaf", async function() {
        for (let i = 0; i < 33; i++) {
            const leaf = ethers.utils.hexlify(ethers.utils.randomBytes(32));
            treeLeft.updateSingle(i, leaf);
            await accountTree.updateSingle(leaf);
            assert.equal(treeLeft.root, await accountTree.rootLeft());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            assert.equal(root, await accountTree.root());
        }
    });
    it("batch update", async function() {
        const batchSize = 1 << BATCH_DEPTH;
        for (let k = 0; k < 4; k++) {
            let leafs = [];
            for (let i = 0; i < batchSize; i++) {
                leafs.push(ethers.utils.hexlify(ethers.utils.randomBytes(32)));
            }
            treeRight.updateBatch(batchSize * k, leafs);
            await (await accountTree.updateBatch(leafs)).wait();
            assert.equal(treeRight.root, await accountTree.rootRight());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            assert.equal(root, await accountTree.root());
        }
    }).timeout(50000);
    it("witness for left side", async function() {
        let leafs = [];
        for (let i = 0; i < 16; i++) {
            leafs.push(ethers.utils.hexlify(ethers.utils.randomBytes(32)));
            treeLeft.updateSingle(i, leafs[i]);
            await accountTree.updateSingle(leafs[i]);
        }
        for (let i = 0; i < 16; i++) {
            let leafIndex = i;
            let leaf = leafs[i];
            let witness = treeLeft.witness(i).nodes;
            const receipt = await (
                await accountTree.checkInclusion(leaf, leafIndex, witness)
            ).wait();
            assert.isTrue(parseEvents(receipt).Return2[1]);
        }
    });
    it("witness for right side", async function() {
        let leafs = [];
        const batchSize = 1 << BATCH_DEPTH;
        for (let i = 0; i < batchSize; i++) {
            leafs.push(ethers.utils.hexlify(ethers.utils.randomBytes(32)));
        }
        treeRight.updateBatch(0, leafs);
        await accountTree.updateBatch(leafs);
        let offset = ethers.utils
            .bigNumberify(2)
            .pow(ethers.utils.bigNumberify(DEPTH));
        for (let i = 0; i < batchSize; i += 41) {
            const leafIndex = offset.add(i);
            let leaf = leafs[i];
            let witness = treeRight.witness(i).nodes;
            let receipt = await (
                await accountTree.checkInclusion(leaf, leafIndex, witness)
            ).wait();
            assert.isTrue(parseEvents(receipt).Return2[1]);
        }
    });

    it("gas cost: update tree single", async function() {
        const leaf = ethers.utils.randomBytes(32);
        const receipt = await (await accountTree.updateSingle(leaf)).wait();
        const gasCost = parseEvents(receipt).Return[0];
        console.log(gasCost.toNumber());
    });
    it("gas cost: update tree batch", async function() {
        const leafs = [];
        for (let i = 0; i < 1 << BATCH_DEPTH; i++) {
            leafs.push(ethers.utils.randomBytes(32));
        }
        const receipt = await (await accountTree.updateBatch(leafs)).wait();
        const gasCost = parseEvents(receipt).Return[0];
        console.log(gasCost.toNumber());
    });
});
