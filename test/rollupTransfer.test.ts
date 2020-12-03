import { TestTransferFactory } from "../types/ethers-contracts/TestTransferFactory";
import { TestTransfer } from "../types/ethers-contracts/TestTransfer";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { serialize } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { assert } from "chai";
import { ethers } from "hardhat";
import { randHex } from "../ts/utils";
import { Result } from "../ts/interfaces";
import { txTransferFactory, UserStateFactory } from "../ts/factory";

const DOMAIN_HEX = randHex(32);
const DOMAIN = Uint8Array.from(Buffer.from(DOMAIN_HEX.slice(2), "hex"));
const BAD_DOMAIN = Uint8Array.from(Buffer.from(randHex(32).slice(2), "hex"));
let STATE_SIZE = 32;
let COMMIT_SIZE = 32;
let STATE_TREE_DEPTH = 32;

describe("Rollup Transfer Commitment", () => {
    let rollup: TestTransfer;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    let states: State[] = [];

    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_HEX);
        const [signer, ...rest] = await ethers.getSigners();
        const registryContract = await new BlsAccountRegistryFactory(
            signer
        ).deploy();

        registry = await AccountRegistry.new(registryContract);
        states = UserStateFactory.buildList(STATE_SIZE);
        for (const state of states) {
            await registry.register(state.getPubkey());
        }
    });

    beforeEach(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        rollup = await new TestTransferFactory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });

    it("transfer commitment: signature check", async function() {
        const txs = txTransferFactory(states, COMMIT_SIZE);
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
        const { safe } = stateTree.processTransferCommit(txs, 0);
        assert.isTrue(safe);
        const serialized = serialize(txs);

        // Need post stateWitnesses
        const postStates = txs.map(tx => stateTree.getState(tx.fromIndex));
        const stateWitnesses = txs.map(tx =>
            stateTree.getStateWitness(tx.fromIndex)
        );

        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();

        const proof = {
            states: postStates,
            stateWitnesses,
            pubkeys,
            pubkeyWitnesses
        };
        const {
            0: gasCost,
            1: result
        } = await rollup.callStatic._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            DOMAIN,
            serialized
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
        const { 1: badSig } = await rollup.callStatic._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            BAD_DOMAIN,
            serialized
        );
        assert.equal(badSig, Result.BadSignature);
        const tx = await rollup._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            DOMAIN,
            serialized
        );
        const receipt = await tx.wait();
        console.log("transaction gas cost:", receipt.gasUsed?.toNumber());
    }).timeout(400000);

    it("transfer commitment: processTx", async function() {
        const txs = txTransferFactory(states, COMMIT_SIZE);
        for (const tx of txs) {
            const preRoot = stateTree.root;
            const [senderProof, receiverProof] = stateTree.processTransfer(tx);
            const postRoot = stateTree.root;
            const {
                0: processedRoot,
                1: result
            } = await rollup.testProcessTransfer(
                preRoot,
                tx,
                states[0].tokenType,
                senderProof,
                receiverProof
            );
            assert.equal(result, Result.Ok, `Got ${Result[result]}`);
            assert.equal(
                processedRoot,
                postRoot,
                "mismatch processed stateroot"
            );
        }
    });
    it("transfer commitment: processTransferCommit", async function() {
        const txs = txTransferFactory(states, COMMIT_SIZE);
        const feeReceiver = 0;

        const preStateRoot = stateTree.root;
        const { proofs, safe } = stateTree.processTransferCommit(
            txs,
            feeReceiver
        );
        assert.isTrue(safe, "Should be a valid applyTransferBatch");
        const postStateRoot = stateTree.root;

        const {
            0: postRoot,
            1: gasCost
        } = await rollup.callStatic.testProcessTransferCommit(
            preStateRoot,
            COMMIT_SIZE,
            feeReceiver,
            serialize(txs),
            proofs
        );
        console.log("processTransferBatch gas cost", gasCost.toNumber());
        assert.equal(postRoot, postStateRoot, "Mismatch post state root");
    }).timeout(80000);
});
