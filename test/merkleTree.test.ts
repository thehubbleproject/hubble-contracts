import { randomLeaves } from "../ts/utils";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { Hasher, Tree } from "../ts/tree";
import { TestMerkleTreeFactory } from "../types/ethers-contracts/TestMerkleTreeFactory";
import { TestMerkleTree } from "../types/ethers-contracts/TestMerkleTree";
import { ZERO_BYTES32 } from "../ts/constants";

// Test all stateless operations
describe("MerkleTreeUtils", async function() {
    const MAX_DEPTH = 32;
    let contract: TestMerkleTree;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contract = await new TestMerkleTreeFactory(signer).deploy(MAX_DEPTH);
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
    it("verify the last leaf", async function() {
        const round = 33;
        let totalCost = 0;
        let size = 1;

        for (let i = 0; i < round; i++) {
            size += 1;
            const leaves = randomLeaves(size);
            const tree = Tree.new(MAX_DEPTH, Hasher.new("bytes", ZERO_BYTES32));
            tree.updateBatch(0, leaves);
            for (const [path, leaf] of leaves.entries()) {
                const {
                    0: result,
                    1: gasCost
                } = await contract.callStatic.testIsLast(
                    tree.root,
                    leaf,
                    path,
                    tree.witness(path).nodes
                );
                if (path == size - 1) {
                    assert.isTrue(result, "Should be the last element");
                    totalCost += gasCost.toNumber();
                } else {
                    assert.isFalse(result, "Should not be the last element");
                }
            }
        }
        console.log(
            "Average cost of verifying a last leaf (success case)",
            Math.ceil(totalCost / round)
        );
    });
});
