import {
    BLSAccountRegistry,
    BLSAccountRegistry__factory
} from "../../types/ethers-contracts";

import { Tree, Hasher } from "../../ts/tree";

import * as mcl from "../../ts/mcl";
import { ethers } from "hardhat";
import { assert } from "chai";
import { ZERO_BYTES32 } from "../../ts/constants";

type RegisterBatchPubkeys = Parameters<BLSAccountRegistry["registerBatch"]>[0];
type ExistsWitness = Parameters<BLSAccountRegistry["exists"]>[2];

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
    let registry: BLSAccountRegistry;
    let treeLeft: Tree;
    let treeRight: Tree;
    beforeEach(async function() {
        await mcl.init();
        const accounts = await ethers.getSigners();
        registry = await new BLSAccountRegistry__factory(accounts[0]).deploy();
        DEPTH = (await registry.DEPTH()).toNumber();
        BATCH_DEPTH = (await registry.BATCH_DEPTH()).toNumber();
        hasher = Hasher.new("bytes", ZERO_BYTES32);
        treeLeft = Tree.new(DEPTH, hasher);
        treeRight = Tree.new(DEPTH, hasher);
        hasher = treeLeft.hasher;
    });

    it("register a public keys", async function() {
        for (let i = 0; i < 33; i++) {
            const { pubkey } = mcl.newKeyPair();
            const { uncompressed, leaf } = pubkeyToLeaf(pubkey);
            treeLeft.updateSingle(i, leaf);
            const tx = await registry.register(uncompressed);
            const events = await registry.queryFilter(
                registry.filters.SinglePubkeyRegistered(null),
                tx.blockHash
            );
            assert.equal(events[0].args?.pubkeyID.toNumber(), i);
        }
        assert.equal(treeLeft.root, await registry.rootLeft());
        assert.equal(treeRight.root, await registry.rootRight());
        const root = hasher.hash2(treeLeft.root, treeRight.root);
        assert.equal(root, await registry.root());
    });
    it("batch update", async function() {
        const batchSize = 2 ** BATCH_DEPTH;
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
            const tx = await registry.registerBatch(
                pubkeys as RegisterBatchPubkeys
            );
            console.log(
                "Batch update cost",
                (await tx.wait()).gasUsed.toNumber()
            );
            const events = await registry.queryFilter(
                registry.filters.BatchPubkeyRegistered(null, null),
                tx.blockHash
            );
            assert.equal(events[0].args?.startID.toNumber(), batchSize * k);
            assert.equal(
                events[0].args?.endID.toNumber(),
                batchSize * k + batchSize - 1
            );
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
            const exist = await registry.exists(
                i,
                pubkeys[i],
                witness as ExistsWitness
            );
            assert.isTrue(exist);
        }
    });
});
