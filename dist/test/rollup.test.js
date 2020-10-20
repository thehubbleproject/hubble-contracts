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
const deploy_1 = require("../ts/deploy");
const constants_1 = require("../ts/constants");
const buidler_1 = require("@nomiclabs/buidler");
const stateTree_1 = require("../ts/stateTree");
const accountTree_1 = require("../ts/accountTree");
const state_1 = require("../ts/state");
const tx_1 = require("../ts/tx");
const mcl = __importStar(require("../ts/mcl"));
const chai_1 = require("chai");
const commitments_1 = require("../ts/commitments");
const decimal_1 = require("../ts/decimal");
const DOMAIN = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
describe("Rollup", async function () {
    const tokenID = 1;
    let Alice;
    let Bob;
    let contracts;
    let stateTree;
    let registry;
    let initialBatch;
    before(async function () {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
    });
    beforeEach(async function () {
        const accounts = await buidler_1.ethers.getSigners();
        contracts = await deploy_1.deployAll(accounts[0], constants_1.TESTING_PARAMS);
        stateTree = new stateTree_1.StateTree(constants_1.TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await accountTree_1.AccountRegistry.new(registryContract);
        const initialBalance = decimal_1.USDT.castInt(55.6);
        Alice = state_1.State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(0);
        Alice.newKeyPair();
        Alice.pubkeyIndex = await registry.register(Alice.getPubkey());
        Bob = state_1.State.new(-1, tokenID, initialBalance, 0);
        Bob.setStateID(1);
        Bob.newKeyPair();
        Bob.pubkeyIndex = await registry.register(Bob.getPubkey());
        stateTree.createState(Alice);
        stateTree.createState(Bob);
        const accountRoot = await registry.root();
        const initialCommitment = commitments_1.TransferCommitment.new(stateTree.root, accountRoot);
        initialBatch = initialCommitment.toBatch();
        await initialBatch.submit(contracts.rollup, constants_1.TESTING_PARAMS.STAKE_AMOUNT);
    });
    it("submit a batch and dispute", async function () {
        const feeReceiver = Alice.stateID;
        const tx = new tx_1.TxTransfer(Alice.stateID, Bob.stateID, decimal_1.USDT.castInt(5.5), decimal_1.USDT.castInt(0.56), Alice.nonce + 1, decimal_1.USDT);
        const signature = Alice.sign(tx);
        const rollup = contracts.rollup;
        const { solProofs, safe } = stateTree.applyTransferBatch([tx], feeReceiver);
        chai_1.assert.isTrue(safe);
        const postStateRoot = stateTree.root;
        const serialized = tx_1.serialize([tx]);
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        chai_1.assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        const commitment = commitments_1.TransferCommitment.new(postStateRoot, root, aggregatedSignature0, feeReceiver, serialized);
        const targetBatch = commitment.toBatch();
        const _txSubmit = await targetBatch.submit(rollup, constants_1.TESTING_PARAMS.STAKE_AMOUNT);
        console.log("submitBatch execution cost", await (await _txSubmit.wait()).gasUsed.toNumber());
        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const batch = await rollup.getBatch(batchId);
        chai_1.assert.equal(batch.commitmentRoot, targetBatch.commitmentRoot, "mismatch commitment tree root");
        const previousMP = initialBatch.proofCompressed(0);
        const commitmentMP = targetBatch.proof(0);
        const _tx = await rollup.disputeTransitionTransfer(batchId, previousMP, commitmentMP, solProofs);
        const receipt = await _tx.wait();
        console.log("disputeBatch execution cost", receipt.gasUsed.toNumber());
        chai_1.assert.equal((await rollup.invalidBatchMarker()).toNumber(), 0, "Good state transition should not rollback");
    });
});
//# sourceMappingURL=rollup.test.js.map