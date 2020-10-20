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
const TestCreate2TransferFactory_1 = require("../types/ethers-contracts/TestCreate2TransferFactory");
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
const TestBlsFactory_1 = require("../types/ethers-contracts/TestBlsFactory");
const DOMAIN_HEX = utils_1.randHex(32);
const DOMAIN = Uint8Array.from(Buffer.from(DOMAIN_HEX.slice(2), "hex"));
const BAD_DOMAIN = Uint8Array.from(Buffer.from(utils_1.randHex(32).slice(2), "hex"));
let STATE_SIZE = 32;
let COMMIT_SIZE = 32;
let STATE_TREE_DEPTH = 32;
describe("Rollup Create2Transfer Commitment", () => {
    let rollup;
    let registry;
    let stateTree;
    let states = [];
    let bls;
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
        bls = await new TestBlsFactory_1.TestBlsFactory(signer).deploy();
        await bls.deployed();
    });
    beforeEach(async function () {
        const [signer, ...rest] = await buidler_1.ethers.getSigners();
        rollup = await new TestCreate2TransferFactory_1.TestCreate2TransferFactory(signer).deploy();
        stateTree = stateTree_1.StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });
    it("create2transfer commitment: signature check", async function () {
        var _a;
        // create 32 new states
        let newStates = factory_1.UserStateFactory.buildList(STATE_SIZE, states.length, states.length);
        const txs = factory_1.txCreate2TransferFactory(states, newStates, COMMIT_SIZE);
        for (const state of newStates) {
            await registry.register(state.getPubkey());
        }
        // concat newstates with the global obj
        states = states.concat(newStates);
        const signatures = [];
        const pubkeysSender = [];
        const pubkeysReceiver = [];
        const pubkeyWitnessesSender = [];
        const pubkeyWitnessesReceiver = [];
        const stateTransitionProof = stateTree.applyCreate2TransferBatch(txs, 0);
        chai_1.assert.isTrue(stateTransitionProof.safe);
        for (const tx of txs) {
            const sender = states[tx.fromIndex];
            const receiver = states[tx.toIndex];
            pubkeysSender.push(sender.getPubkey());
            pubkeyWitnessesSender.push(registry.witness(sender.pubkeyIndex));
            pubkeysReceiver.push(receiver.getPubkey());
            pubkeyWitnessesReceiver.push(registry.witness(receiver.pubkeyIndex));
            signatures.push(sender.sign(tx));
        }
        const signature = mcl.aggreagate(signatures);
        const serialized = tx_1.serialize(txs);
        // Need post stateWitnesses
        const postStates = txs.map(tx => stateTree.getState(tx.fromIndex));
        const stateWitnesses = txs.map(tx => stateTree.getStateWitness(tx.fromIndex));
        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();
        const proof = {
            states: postStates,
            stateWitnesses,
            pubkeysSender,
            pubkeyWitnessesSender,
            pubkeysReceiver: pubkeysReceiver,
            pubkeyWitnessesReceiver: pubkeyWitnessesReceiver
        };
        const { 0: gasCost, 1: result } = await rollup.callStatic._checkSignature(signature, proof, postStateRoot, accountRoot, DOMAIN, serialized);
        chai_1.assert.equal(result, interfaces_1.Result.Ok, `Got ${interfaces_1.Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
        const { 1: badSig } = await rollup.callStatic._checkSignature(signature, proof, postStateRoot, accountRoot, BAD_DOMAIN, serialized);
        chai_1.assert.equal(badSig, interfaces_1.Result.BadSignature);
        const checkSigTx = await rollup._checkSignature(signature, proof, postStateRoot, accountRoot, DOMAIN, serialized);
        const receipt = await checkSigTx.wait();
        console.log("transaction gas cost:", (_a = receipt.gasUsed) === null || _a === void 0 ? void 0 : _a.toNumber());
    }).timeout(800000);
    it("create2trasnfer commitment: processTx", async function () {
        let newStates = factory_1.UserStateFactory.buildList(STATE_SIZE, states.length, states.length);
        const txs = factory_1.txCreate2TransferFactory(states, newStates, COMMIT_SIZE);
        for (const state of newStates) {
            await registry.register(state.getPubkey());
        }
        // concat newstates with the global obj
        states = states.concat(newStates);
        for (const tx of txs) {
            const preRoot = stateTree.root;
            const proof = stateTree.applyTxCreate2Transfer(tx);
            const [senderProof, receiverProof] = stateTree_1.solProofFromCreate2Transfer(proof);
            chai_1.assert.isTrue(proof.safe);
            const postRoot = stateTree.root;
            const { 0: processedRoot, 1: result } = await rollup.testProcessTx(preRoot, tx, states[0].tokenType, senderProof, receiverProof);
            chai_1.assert.equal(result, interfaces_1.Result.Ok, `Got ${interfaces_1.Result[result]}`);
            chai_1.assert.equal(processedRoot, postRoot, "mismatch processed stateroot");
        }
    }).timeout(80000);
});
//# sourceMappingURL=create2transfer.test.js.map