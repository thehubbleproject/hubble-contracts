import { LoggerFactory } from "../types/ethers-contracts/LoggerFactory";
import { TestTransferFactory } from "../types/ethers-contracts/TestTransferFactory";
import { TestTransfer } from "../types/ethers-contracts/TestTransfer";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { serialize } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { randHex } from "../ts/utils";
import { ErrorCode } from "../ts/interfaces";
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

    before(async function () {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_HEX);
        const [signer, ...rest] = await ethers.getSigners();
        const logger = await new LoggerFactory(signer).deploy();
        const registryContract = await new BlsAccountRegistryFactory(
            signer
        ).deploy(logger.address);

        registry = await AccountRegistry.new(registryContract);
        states = UserStateFactory.buildList(STATE_SIZE);
        for (const state of states) {
            await registry.register(state.encodePubkey());
        }
    });

    beforeEach(async function () {
        const [signer, ...rest] = await ethers.getSigners();
        rollup = await new TestTransferFactory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });

    it("transfer commitment: signature check", async function () {
        const txs = txTransferFactory(states, COMMIT_SIZE);
        let aggSignature = mcl.newG1();
        const pubkeys = [];
        const pubkeyWitnesses = [];

        for (const tx of txs) {
            const sender = states[tx.fromIndex];
            pubkeys.push(sender.encodePubkey());
            pubkeyWitnesses.push(registry.witness(sender.pubkeyIndex));
            const signature = sender.sign(tx);
            aggSignature = mcl.aggreagate(aggSignature, signature);
        }
        const signature = mcl.g1ToHex(aggSignature);
        const stateTransitionProof = stateTree.applyTransferBatch(txs, 0);
        assert.isTrue(stateTransitionProof.safe);
        const serialized = serialize(txs);

        // Need post stateWitnesses
        const postStates = txs.map((tx) => stateTree.getState(tx.fromIndex));
        const stateWitnesses = txs.map((tx) =>
            stateTree.getStateWitness(tx.fromIndex)
        );

        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();

        const proof = {
            states: postStates,
            stateWitnesses,
            pubkeys,
            pubkeyWitnesses,
        };
        const {
            0: gasCost,
            1: error,
        } = await rollup.callStatic._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            DOMAIN,
            serialized
        );
        assert.equal(error, ErrorCode.NoError, `Got ${ErrorCode[error]}`);
        console.log("operation gas cost:", gasCost.toString());
        const { 1: badSig } = await rollup.callStatic._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            BAD_DOMAIN,
            serialized
        );
        assert.equal(badSig, ErrorCode.BadSignature);
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

    it("transfer commitment: processTx", async function () {
        const txs = txTransferFactory(states, COMMIT_SIZE);
        for (const tx of txs) {
            const preRoot = stateTree.root;
            const proof = stateTree.applyTxTransfer(tx);
            assert.isTrue(proof.safe);
            const postRoot = stateTree.root;
            const { 0: processedRoot, 3: error } = await rollup.testProcessTx(
                preRoot,
                tx,
                states[0].tokenType,
                {
                    state: proof.sender,
                    witness: proof.senderWitness,
                },
                {
                    state: proof.receiver,
                    witness: proof.receiverWitness,
                }
            );
            assert.equal(error, ErrorCode.NoError, `Got ${ErrorCode[error]}`);
            assert.equal(
                processedRoot,
                postRoot,
                "mismatch processed stateroot"
            );
        }
    });
    it("transfer commitment: processTransferCommit", async function () {
        const txs = txTransferFactory(states, COMMIT_SIZE);
        const feeReceiver = 0;

        const preStateRoot = stateTree.root;
        const { proof, feeProof, safe } = stateTree.applyTransferBatch(
            txs,
            feeReceiver
        );
        assert.isTrue(safe, "Should be a valid applyTransferBatch");
        const stateMerkleProof = [];
        for (let i = 0; i < COMMIT_SIZE; i++) {
            stateMerkleProof.push({
                state: proof[i].sender,
                witness: proof[i].senderWitness,
            });
            stateMerkleProof.push({
                state: proof[i].receiver,
                witness: proof[i].receiverWitness,
            });
        }
        stateMerkleProof.push({
            state: feeProof.feeReceiver,
            witness: feeProof.feeReceiverWitness,
        });
        const postStateRoot = stateTree.root;

        const {
            0: postRoot,
            1: gasCost,
        } = await rollup.callStatic.testProcessTransferCommit(
            preStateRoot,
            serialize(txs),
            stateMerkleProof,
            states[0].tokenType,
            feeReceiver
        );
        console.log("processTransferBatch gas cost", gasCost.toNumber());
        assert.equal(postRoot, postStateRoot, "Mismatch post state root");
    }).timeout(80000);
});
