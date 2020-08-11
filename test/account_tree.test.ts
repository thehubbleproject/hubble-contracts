const TestAccountTree = artifacts.require("TestAccountTree");
import { TestAccountTreeInstance } from "../types/truffle-contracts";
import { Tree, Hasher } from "./utils/tree";

let DEPTH: number;
let BATCH_DEPTH: number;
describe("Account Tree", async () => {
    let accountTree: TestAccountTreeInstance;
    let treeLeft: Tree;
    let treeRight: Tree;
    let hasher: Hasher;
    beforeEach(async function() {
        accountTree = await TestAccountTree.new();
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
            const leaf = web3.utils.randomHex(32);
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
                leafs.push(web3.utils.randomHex(32));
            }
            treeRight.updateBatch(batchSize * k, leafs);
            await accountTree.updateBatch(leafs);
            assert.equal(treeRight.root, await accountTree.rootRight());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            assert.equal(root, await accountTree.root());
        }
    });
    it("witness for left side", async function() {
        let leafs = [];
        for (let i = 0; i < 16; i++) {
            leafs.push(web3.utils.randomHex(32));
            treeLeft.updateSingle(i, leafs[i]);
            await accountTree.updateSingle(leafs[i]);
        }
        for (let i = 0; i < 16; i++) {
            let leafIndex = i;
            let leaf = leafs[i];
            let witness = treeLeft.witness(i).nodes;
            let res = await accountTree.checkInclusion.call(
                leaf,
                leafIndex,
                witness
            );
            assert.isTrue(res[1]);
        }
    });
    it("witness for right side", async function() {
        let leafs = [];
        const batchSize = 1 << BATCH_DEPTH;
        for (let i = 0; i < batchSize; i++) {
            leafs.push(web3.utils.randomHex(32));
        }
        treeRight.updateBatch(0, leafs);
        await accountTree.updateBatch(leafs);
        let offset = web3.utils.toBN(2).pow(web3.utils.toBN(DEPTH));
        for (let i = 0; i < batchSize; i += 41) {
            const leafIndex = offset.add(web3.utils.toBN(i));
            let leaf = leafs[i];
            let witness = treeRight.witness(i).nodes;
            let res = await accountTree.checkInclusion.call(
                leaf,
                leafIndex,
                witness
            );
            assert.isTrue(res[1]);
        }
    });

    it.skip("gas cost: update tree single", async function() {
        const leaf = web3.utils.randomHex(32);
        const gasCost = await accountTree.updateSingle.call(leaf);
        console.log(gasCost.toNumber());
    });
    it.skip("gas cost: update tree batch", async function() {
        const leafs = [];
        for (let i = 0; i < 1 << BATCH_DEPTH; i++) {
            leafs.push(web3.utils.randomHex(32));
        }
        const gasCost = await accountTree.updateBatch.call(leafs);
        console.log(gasCost.toNumber());
    });
});
