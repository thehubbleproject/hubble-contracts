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
const interfaces_1 = require("../ts/interfaces");
const tree_1 = require("../ts/tree");
const utils_1 = require("../ts/utils");
describe("Mass Migrations", async function () {
    const tokenID = 1;
    let Alice;
    let contracts;
    let stateTree;
    let registry;
    let initialBatch;
    before(async function () {
        await mcl.init();
    });
    beforeEach(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        contracts = await deploy_1.deployAll(signer, constants_1.TESTING_PARAMS);
        const { rollup, blsAccountRegistry } = contracts;
        mcl.setDomainHex(await rollup.appID());
        stateTree = new stateTree_1.StateTree(constants_1.TESTING_PARAMS.MAX_DEPTH);
        const registryContract = blsAccountRegistry;
        registry = await accountTree_1.AccountRegistry.new(registryContract);
        const initialBalance = decimal_1.USDT.castInt(1000.0);
        Alice = state_1.State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        Alice.pubkeyIndex = await registry.register(Alice.getPubkey());
        stateTree.createState(Alice);
        const accountRoot = await registry.root();
        const initialCommitment = commitments_1.MassMigrationCommitment.new(stateTree.root, accountRoot);
        initialBatch = initialCommitment.toBatch();
        // We submit a batch that has a stateRoot containing Alice and Bob
        await initialBatch.submit(rollup, constants_1.TESTING_PARAMS.STAKE_AMOUNT);
    });
    it("submit a batch and dispute", async function () {
        const { rollup, massMigration } = contracts;
        const feeReceiver = Alice.stateID;
        const tx = new tx_1.TxMassMigration(Alice.stateID, decimal_1.USDT.castInt(39.99), 1, decimal_1.USDT.castInt(0.01), Alice.nonce + 1, decimal_1.USDT);
        const signature = Alice.sign(tx);
        const stateRoot = stateTree.root;
        const { proofs, safe } = stateTree.applyMassMigrationBatch([tx], feeReceiver);
        chai_1.assert.isTrue(safe);
        const txs = tx.encode();
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const root = await registry.root();
        const leaf = state_1.State.new(Alice.pubkeyIndex, tokenID, tx.amount, 0).toStateLeaf();
        const withdrawRoot = tree_1.Tree.merklize([leaf]).root;
        const commitment = commitments_1.MassMigrationCommitment.new(stateRoot, root, aggregatedSignature0, tx.spokeID, withdrawRoot, tokenID, tx.amount, feeReceiver, txs);
        const { 0: postStateRoot, 1: result } = await massMigration.processMassMigrationCommit(stateRoot, commitment.toSolStruct().body, proofs);
        chai_1.assert.equal(postStateRoot, stateTree.root, "should have same state root");
        chai_1.assert.equal(result, interfaces_1.Result.Ok, `Got ${interfaces_1.Result[result]}`);
        commitment.stateRoot = postStateRoot;
        const targetBatch = commitment.toBatch();
        await targetBatch.submit(rollup, constants_1.TESTING_PARAMS.STAKE_AMOUNT);
        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const rootOnchain = await registry.registry.root();
        chai_1.assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        const batch = await rollup.getBatch(batchId);
        chai_1.assert.equal(batch.commitmentRoot, targetBatch.commitmentRoot, "mismatch commitment tree root");
        const previousMP = initialBatch.proofCompressed(0);
        const commitmentMP = targetBatch.proof(0);
        await rollup.disputeTransitionMassMigration(batchId, previousMP, commitmentMP, proofs);
        chai_1.assert.equal((await rollup.invalidBatchMarker()).toNumber(), 0, "Good state transition should not rollback");
    });
    it("submit a batch, finalize, and withdraw", async function () {
        const { rollup, withdrawManager, testToken, vault } = contracts;
        const feeReceiver = Alice.stateID;
        const tx = new tx_1.TxMassMigration(Alice.stateID, decimal_1.USDT.castInt(39.99), 1, decimal_1.USDT.castInt(0.01), Alice.nonce + 1, decimal_1.USDT);
        const leaf = state_1.State.new(Alice.pubkeyIndex, tokenID, tx.amount, 0).toStateLeaf();
        const withdrawTree = tree_1.Tree.merklize([leaf]);
        const { safe } = stateTree.applyMassMigrationBatch([tx], feeReceiver);
        chai_1.assert.isTrue(safe);
        const commitment = commitments_1.MassMigrationCommitment.new(stateTree.root, await registry.root(), mcl.aggreagate([Alice.sign(tx)]), tx.spokeID, withdrawTree.root, tokenID, tx.amount, feeReceiver, tx.encode());
        const batch = commitment.toBatch();
        await batch.submit(rollup, constants_1.TESTING_PARAMS.STAKE_AMOUNT);
        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        await chai_1.expect(withdrawManager.processWithdrawCommitment(batchId, batch.proof(0))).revertedWith("Vault: Batch shoould be finalised");
        await utils_1.mineBlocks(buidler_1.ethers.provider, constants_1.TESTING_PARAMS.TIME_TO_FINALISE);
        // We cheat here a little bit by sending token to the vault manually.
        // Ideally the tokens of the vault should come from the deposits
        await testToken.transfer(vault.address, tx.amount);
        const txProcess = await withdrawManager.processWithdrawCommitment(batchId, batch.proof(0));
        const receiptProcess = await txProcess.wait();
        console.log("Transaction cost: Process Withdraw Commitment", receiptProcess.gasUsed.toNumber());
        const withdrawal = withdrawTree.witness(0);
        const [, claimer] = await buidler_1.ethers.getSigners();
        const claimerAddress = await claimer.getAddress();
        const { signature } = mcl.sign(claimerAddress, Alice.secretKey);
        const state = {
            pubkeyIndex: Alice.pubkeyIndex,
            tokenType: tokenID,
            balance: tx.amount,
            nonce: 0
        };
        const withdrawProof = {
            state,
            path: withdrawal.index,
            witness: withdrawal.nodes
        };
        const txClaim = await withdrawManager
            .connect(claimer)
            .claimTokens(commitment.withdrawRoot, withdrawProof, Alice.publicKey, mcl.g1ToHex(signature), registry.witness(Alice.pubkeyIndex));
        const receiptClaim = await txClaim.wait();
        console.log("Transaction cost: claiming a token", receiptClaim.gasUsed.toNumber());
        await chai_1.expect(withdrawManager
            .connect(claimer)
            .claimTokens(commitment.withdrawRoot, withdrawProof, Alice.publicKey, mcl.g1ToHex(signature), registry.witness(Alice.pubkeyIndex))).revertedWith("WithdrawManager: Token has been claimed");
    });
});
//# sourceMappingURL=MassMigration.test.js.map