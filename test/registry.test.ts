const AccountRegistry = artifacts.require("BLSAccountRegistry");
import { BlsAccountRegistryInstance } from "../types/truffle-contracts";
import { Tree, Hasher } from "./utils/tree";

import * as mcl from "./utils/mcl";
import { ethers } from "ethers";

let DEPTH: number;
let BATCH_DEPTH: number;
let hasher: Hasher;

type Pubkey = mcl.mclG2;

function pubkeyToLeaf(p: Pubkey) {
    const uncompressed = mcl.g2ToHex(p);
    const leaf = ethers.utils.solidityKeccak256(
        ["uint256", "uint256", "uint256", "uint256"],
        uncompressed
    );
    return { uncompressed, leaf };
}

describe.skip("Registry", async () => {
    let registry: BlsAccountRegistryInstance;
    let treeLeft: Tree;
    let treeRight: Tree;
    beforeEach(async function() {
        await mcl.init();
        registry = await AccountRegistry.new();
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
    it("batch update", async function() {
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
            pubkeys.push(pubkey);
            treeLeft.updateSingle(i, leaf);
            await registry.register(uncompressed);
        }
        for (let i = 0; i < 16; i++) {
            const leafIndex = i;
            const uncompressed = mcl.g2ToHex(pubkeys[i]);
            const witness = treeLeft.witness(leafIndex).nodes;
            const exist = await registry.exists(
                leafIndex,
                uncompressed,
                witness
            );
            assert.isTrue(exist);
        }
    });
});
