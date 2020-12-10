import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";

import { Tree, Hasher } from "../ts/tree";

import * as mcl from "../ts/mcl";
import { ethers } from "hardhat";
import { assert } from "chai";

let DEPTH: number;
let BATCH_DEPTH: number;
let hasher: Hasher;

function pubkeyToLeaf(uncompressedMcl: mcl.mclG2) {
    const uncompressed = mcl.g2ToHex(uncompressedMcl);
    const leaf = ethers.utils.solidityKeccak256(
        ["uint256", "uint256", "uint256", "uint256"],
        uncompressed
    );
    return { uncompressed, leaf };
}

describe("Registry", async () => {
    let registry: BlsAccountRegistry;
    let treeLeft: Tree;
    let treeRight: Tree;
    beforeEach(async function() {
        await mcl.init();
        const accounts = await ethers.getSigners();
        registry = await new BlsAccountRegistryFactory(accounts[0]).deploy();
        DEPTH = (await registry.DEPTH()).toNumber();
        BATCH_DEPTH = (await registry.BATCH_DEPTH()).toNumber();
        treeLeft = Tree.new(DEPTH);
        treeRight = Tree.new(DEPTH);
        hasher = treeLeft.hasher;
    });

    it("register a public keys", async function() {
        for (let i = 0; i < 33; i++) {
            const { pubkey } = mcl.newKeyPair();
            const { uncompressed, leaf } = pubkeyToLeaf(pubkey);
            treeLeft.updateSingle(i, leaf);
            await registry.register(uncompressed);
        }
        assert.equal(treeLeft.root, await registry.rootLeft());
        assert.equal(treeRight.root, await registry.rootRight());
        const root = hasher.hash2(treeLeft.root, treeRight.root);
        assert.equal(root, await registry.root());
    });
    it.skip("batch update", async function() {
        const batchSize = 1 << BATCH_DEPTH;
        for (let k = 0; k < 4; k++) {
            let leafs = [];
            let pubkeys = [];
            for (let i = 0; i < batchSize; i++) {
                const { pubkey } = mcl.newKeyPair();
                const { uncompressed, leaf } = pubkeyToLeaf(pubkey);
                leafs.push(leaf);
                pubkeys.push(uncompressed);
            }
            treeRight.updateBatch(batchSize * k, leafs);
            await registry.registerBatch(pubkeys);
            assert.equal(treeRight.root, await registry.rootRight());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            assert.equal(root, await registry.root());
        }
    });
    it("exists", async function() {
        let leafs = [];
        let pubkeys = [];
        for (let i = 0; i < 16; i++) {
            const { pubkey } = mcl.newKeyPair();
            const { uncompressed, leaf } = pubkeyToLeaf(pubkey);
            leafs.push(leaf);
            pubkeys.push(mcl.g2ToHex(pubkey));
            treeLeft.updateSingle(i, leaf);
            await registry.register(uncompressed);
        }
        for (let i = 0; i < 16; i++) {
            const witness = treeLeft.witness(i).nodes;
            const exist = await registry.exists(i, pubkeys[i], witness);
            assert.isTrue(exist);
        }
    });
});
