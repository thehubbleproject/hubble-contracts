"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../ts/utils");
const chai_1 = require("chai");
const buidler_1 = require("@nomiclabs/buidler");
const tree_1 = require("../ts/tree");
const TestMerkleTreeFactory_1 = require("../types/ethers-contracts/TestMerkleTreeFactory");
describe("MerkleTree", async function () {
    const MAX_DEPTH = 32;
    let contract;
    before(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        contract = await new TestMerkleTreeFactory_1.TestMerkleTreeFactory(signer).deploy();
    });
    it("verify", async function () {
        const size = 50;
        let totalCost = 0;
        const leaves = utils_1.randomLeaves(size);
        const tree = tree_1.Tree.new(MAX_DEPTH);
        tree.updateBatch(0, leaves);
        for (const [path, leaf] of leaves.entries()) {
            const { 0: result, 1: gasCost } = await contract.callStatic.testVerify(tree.root, leaf, path, tree.witness(path).nodes);
            chai_1.assert.isTrue(result);
            totalCost += gasCost.toNumber();
        }
        console.log("Average cost of verifying a leaf", totalCost / size);
    });
    it("merklize", async function () {
        const sizes = [1, 5, 10, 20, 32];
        for (const size of sizes) {
            const leaves = utils_1.randomLeaves(size);
            const { 0: root, 1: gasCost } = await contract.callStatic.testMerklise(leaves);
            chai_1.assert.equal(root, tree_1.Tree.merklize(leaves).root);
            console.log(`Merklizing ${size} leaves onchain`, gasCost.toNumber());
        }
    });
    it("testGetRoot", async function () {
        const levels = [0, 5, 10, 20, 31];
        for (const level of levels) {
            const { 1: gasCost } = await contract.callStatic.testGetRoot(level);
            console.log(`Get Root at level ${level}`, gasCost.toNumber());
        }
    });
});
//# sourceMappingURL=merkleTree.test.js.map