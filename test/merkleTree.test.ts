import { randomLeaves } from "../ts/utils";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { Tree } from "../ts/tree";
import { TestMerkleTreeFactory } from "../types/ethers-contracts/TestMerkleTreeFactory";
import { TestMerkleTree } from "../types/ethers-contracts/TestMerkleTree";

// Test all stateless operations
describe("MerkleTreeUtils", async function() {
    const MAX_DEPTH = 32;
    let contract: TestMerkleTree;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contract = await new TestMerkleTreeFactory(signer).deploy();
    });
    it("verify", async function() {
        const size = 50;
        let totalCost = 0;
        const leaves = randomLeaves(size);
        const tree = Tree.new(MAX_DEPTH);
        tree.updateBatch(0, leaves);
        for (const [path, leaf] of leaves.entries()) {
            const {
                0: result,
                1: gasCost
            } = await contract.callStatic.testVerify(
                tree.root,
                leaf,
                path,
                tree.witness(path).nodes
            );
            assert.isTrue(result);
            totalCost += gasCost.toNumber();
        }
        console.log("Average cost of verifying a leaf", totalCost / size);
    });
});
