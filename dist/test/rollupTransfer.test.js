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
const LoggerFactory_1 = require("../types/ethers-contracts/LoggerFactory");
const TestTransferFactory_1 = require("../types/ethers-contracts/TestTransferFactory");
const BlsAccountRegistryFactory_1 = require("../types/ethers-contracts/BlsAccountRegistryFactory");
const tx_1 = require("../ts/tx");
const mcl = __importStar(require("../ts/mcl"));
const stateTree_1 = require("../ts/stateTree");
const accountTree_1 = require("../ts/accountTree");
const chai_1 = require("chai");
const buidler_1 = require("@nomiclabs/buidler");
const utils_1 = require("../ts/utils");
const interfaces_1 = require("../ts/interfaces");
const factory_1 = require("../ts/factory");
const DOMAIN_HEX = utils_1.randHex(32);
const DOMAIN = Uint8Array.from(Buffer.from(DOMAIN_HEX.slice(2), "hex"));
const BAD_DOMAIN = Uint8Array.from(Buffer.from(utils_1.randHex(32).slice(2), "hex"));
let STATE_SIZE = 32;
let COMMIT_SIZE = 32;
let STATE_TREE_DEPTH = 32;
describe("Rollup Transfer Commitment", () => {
    let rollup;
    let registry;
    let stateTree;
    let states = [];
    before(async function () {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_HEX);
        const [signer, ...rest] = await buidler_1.ethers.getSigners();
        const logger = await new LoggerFactory_1.LoggerFactory(signer).deploy();
        const registryContract = await new BlsAccountRegistryFactory_1.BlsAccountRegistryFactory(signer).deploy(logger.address);
        registry = await accountTree_1.AccountRegistry.new(registryContract);
        states = factory_1.UserStateFactory.buildList(STATE_SIZE);
        for (const state of states) {
            await registry.register(state.getPubkey());
        }
    });
    beforeEach(async function () {
        const [signer, ...rest] = await buidler_1.ethers.getSigners();
        rollup = await new TestTransferFactory_1.TestTransferFactory(signer).deploy();
        stateTree = stateTree_1.StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });
    it("transfer commitment: signature check", async function () {
        var _a;
        const txs = factory_1.txTransferFactory(states, COMMIT_SIZE);
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
        const stateTransitionProof = stateTree.applyTransferBatch(txs, 0);
        chai_1.assert.isTrue(stateTransitionProof.safe);
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
        const { 0: gasCost, 1: result } = await rollup.callStatic._checkSignature(signature, proof, postStateRoot, accountRoot, DOMAIN, serialized);
        chai_1.assert.equal(result, interfaces_1.Result.Ok, `Got ${interfaces_1.Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
        const { 1: badSig } = await rollup.callStatic._checkSignature(signature, proof, postStateRoot, accountRoot, BAD_DOMAIN, serialized);
        chai_1.assert.equal(badSig, interfaces_1.Result.BadSignature);
        const tx = await rollup._checkSignature(signature, proof, postStateRoot, accountRoot, DOMAIN, serialized);
        const receipt = await tx.wait();
        console.log("transaction gas cost:", (_a = receipt.gasUsed) === null || _a === void 0 ? void 0 : _a.toNumber());
    }).timeout(400000);
    it("transfer commitment: processTx", async function () {
        const txs = factory_1.txTransferFactory(states, COMMIT_SIZE);
        for (const tx of txs) {
            const preRoot = stateTree.root;
            const proof = stateTree.applyTxTransfer(tx);
            const [senderProof, receiverProof] = stateTree_1.solProofFromTransfer(proof);
            chai_1.assert.isTrue(proof.safe);
            const postRoot = stateTree.root;
            const { 0: processedRoot, 1: result } = await rollup.testProcessTx(preRoot, tx, states[0].tokenType, senderProof, receiverProof);
            chai_1.assert.equal(result, interfaces_1.Result.Ok, `Got ${interfaces_1.Result[result]}`);
            chai_1.assert.equal(processedRoot, postRoot, "mismatch processed stateroot");
        }
    });
    it("transfer commitment: processTransferCommit", async function () {
        const txs = factory_1.txTransferFactory(states, COMMIT_SIZE);
        const feeReceiver = 0;
        const preStateRoot = stateTree.root;
        const { solProofs, safe } = stateTree.applyTransferBatch(txs, feeReceiver);
        chai_1.assert.isTrue(safe, "Should be a valid applyTransferBatch");
        const postStateRoot = stateTree.root;
        const { 0: postRoot, 1: gasCost } = await rollup.callStatic.testProcessTransferCommit(preStateRoot, tx_1.serialize(txs), solProofs, feeReceiver);
        console.log("processTransferBatch gas cost", gasCost.toNumber());
        chai_1.assert.equal(postRoot, postStateRoot, "Mismatch post state root");
    }).timeout(80000);
});
//# sourceMappingURL=rollupTransfer.test.js.map