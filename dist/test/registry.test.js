"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const BlsAccountRegistryFactory_1 = require("../types/ethers-contracts/BlsAccountRegistryFactory");
const LoggerFactory_1 = require("../types/ethers-contracts/LoggerFactory");
const tree_1 = require("../ts/tree");
const mcl = __importStar(require("../ts/mcl"));
const buidler_1 = require("@nomiclabs/buidler");
const chai_1 = require("chai");
let DEPTH;
let BATCH_DEPTH;
let hasher;
function pubkeyToLeaf(uncompressed) {
    const leaf = buidler_1.ethers.utils.solidityKeccak256(["uint256", "uint256", "uint256", "uint256"], uncompressed);
    return { uncompressed, leaf };
}
describe("Registry", async () => {
    let registry;
    let treeLeft;
    let treeRight;
    beforeEach(async function () {
        await mcl.init();
        const accounts = await buidler_1.ethers.getSigners();
        const logger = await new LoggerFactory_1.LoggerFactory(accounts[0]).deploy();
        registry = await new BlsAccountRegistryFactory_1.BlsAccountRegistryFactory(accounts[0]).deploy(logger.address);
        DEPTH = (await registry.DEPTH()).toNumber();
        BATCH_DEPTH = (await registry.BATCH_DEPTH()).toNumber();
        treeLeft = tree_1.Tree.new(DEPTH);
        treeRight = tree_1.Tree.new(DEPTH);
        hasher = treeLeft.hasher;
    });
    it("register a public keys", async function () {
        for (let i = 0; i < 33; i++) {
            const { pubkey } = mcl.newKeyPair();
            const { uncompressed, leaf } = pubkeyToLeaf(pubkey);
            treeLeft.updateSingle(i, leaf);
            await registry.register(uncompressed);
        }
        chai_1.assert.equal(treeLeft.root, await registry.rootLeft());
        chai_1.assert.equal(treeRight.root, await registry.rootRight());
        const root = hasher.hash2(treeLeft.root, treeRight.root);
        chai_1.assert.equal(root, await registry.root());
    });
    it.skip("batch update", async function () {
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
            chai_1.assert.equal(treeRight.root, await registry.rootRight());
            const root = hasher.hash2(treeLeft.root, treeRight.root);
            chai_1.assert.equal(root, await registry.root());
        }
    });
    it("exists", async function () {
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
            const witness = treeLeft.witness(i).nodes;
            const exist = await registry.exists(i, pubkeys[i], witness);
            chai_1.assert.isTrue(exist);
        }
    });
});
//# sourceMappingURL=registry.test.js.map