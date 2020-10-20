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
const buidler_1 = require("@nomiclabs/buidler");
const accountTree_1 = require("../ts/accountTree");
const factory_1 = require("../ts/factory");
const state_1 = require("../ts/state");
const stateTree_1 = require("../ts/stateTree");
const utils_1 = require("../ts/utils");
const ethers_contracts_1 = require("../types/ethers-contracts");
const mcl = __importStar(require("../ts/mcl"));
const tx_1 = require("../ts/tx");
const chai_1 = require("chai");
const interfaces_1 = require("../ts/interfaces");
const ethers_1 = require("ethers");
const tree_1 = require("../ts/tree");
const DOMAIN_HEX = utils_1.randHex(32);
const STATE_SIZE = 32;
const COMMIT_SIZE = 32;
const STATE_TREE_DEPTH = 32;
const spokeID = 1;
describe("Rollup Mass Migration", () => {
    let rollup;
    let registry;
    let stateTree;
    let states = [];
    before(async function () {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_HEX);
        const [signer] = await buidler_1.ethers.getSigners();
        const logger = await new ethers_contracts_1.LoggerFactory(signer).deploy();
        const registryContract = await new ethers_contracts_1.BlsAccountRegistryFactory(signer).deploy(logger.address);
        registry = await accountTree_1.AccountRegistry.new(registryContract);
        states = factory_1.UserStateFactory.buildList(STATE_SIZE);
        for (const state of states) {
            await registry.register(state.getPubkey());
        }
    });
    beforeEach(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        rollup = await new ethers_contracts_1.TestMassMigrationFactory(signer).deploy();
        stateTree = stateTree_1.StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });
    it("checks signature", async function () {
        const txs = factory_1.txMassMigrationFactory(states, COMMIT_SIZE, spokeID);
        const signatures = [];
        const pubkeys = [];
        const pubkeyWitnesses = [];
        for (const tx of txs) {
            const sender = states[tx.fromIndex];
            pubkeys.push(sender.getPubkey());
            pubkeyWitnesses.push(registry.witness(sender.pubkeyIndex));
            signatures.push(sender.sign(tx));
        }
        const signature = mcl.aggreagate(signatures);
        const { safe } = stateTree.applyMassMigrationBatch(txs, 0);
        chai_1.assert.isTrue(safe);
        const serialized = tx_1.serialize(txs);
        // Need post stateWitnesses
        const postStates = txs.map(tx => stateTree.getState(tx.fromIndex));
        const stateWitnesses = txs.map(tx => stateTree.getStateWitness(tx.fromIndex));
        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();
        const proof = {
            states: postStates,
            stateWitnesses,
            pubkeys,
            pubkeyWitnesses
        };
        const { 0: gasCost, 1: result } = await rollup.callStatic.testCheckSignature(signature, proof, postStateRoot, accountRoot, DOMAIN_HEX, spokeID, serialized);
        chai_1.assert.equal(result, interfaces_1.Result.Ok, `Got ${interfaces_1.Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
    }).timeout(400000);
    it("checks state transitions", async function () {
        const txs = factory_1.txMassMigrationFactory(states, COMMIT_SIZE, spokeID);
        const feeReceiver = 0;
        const preStateRoot = stateTree.root;
        const { proofs, safe } = stateTree.applyMassMigrationBatch(txs, feeReceiver);
        chai_1.assert.isTrue(safe, "Should be a valid applyTransferBatch");
        const postStateRoot = stateTree.root;
        const tokenID = states[0].tokenType;
        const leaves = txs.map(tx => state_1.State.new(states[tx.fromIndex].pubkeyIndex, tokenID, tx.amount, 0).toStateLeaf());
        const withdrawRoot = tree_1.Tree.merklize(leaves).root;
        const commitmentBody = {
            accountRoot: ethers_1.constants.HashZero,
            signature: [0, 0],
            targetSpokeID: spokeID,
            withdrawRoot,
            tokenID,
            amount: utils_1.sum(txs.map(tx => tx.amount)),
            feeReceiver,
            txs: tx_1.serialize(txs)
        };
        const { 0: gasCost, 1: postRoot, 2: result } = await rollup.callStatic.testProcessMassMigrationCommit(preStateRoot, commitmentBody, proofs);
        console.log("processTransferBatch gas cost", gasCost.toNumber());
        chai_1.assert.equal(postRoot, postStateRoot, "Mismatch post state root");
        chai_1.assert.equal(interfaces_1.Result[result], interfaces_1.Result[interfaces_1.Result.Ok]);
    }).timeout(80000);
});
//# sourceMappingURL=rollupMassMigration.test.js.map