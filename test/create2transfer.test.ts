import { LoggerFactory } from "../types/ethers-contracts/LoggerFactory";
import { TestCreate2TransferFactory } from "../types/ethers-contracts/TestCreate2TransferFactory";
import { TestCreate2Transfer } from "../types/ethers-contracts/TestCreate2Transfer";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";
import { serialize, TxCreate2Transfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { randHex } from "../ts/utils";
import { ErrorCode } from "../ts/interfaces";
import { txCreate2TransferFactory, UserStateFactory } from "../ts/factory";
import { USDT } from "../ts/decimal";

const DOMAIN_HEX = randHex(32);
const DOMAIN = Uint8Array.from(Buffer.from(DOMAIN_HEX.slice(2), "hex"));
const BAD_DOMAIN = Uint8Array.from(Buffer.from(randHex(32).slice(2), "hex"));
let STATE_SIZE = 32;
let COMMIT_SIZE = 32;
let STATE_TREE_DEPTH = 32;

describe("Rollup Create2Transfer Commitment", () => {
    let rollup: TestCreate2Transfer;
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
        rollup = await new TestCreate2TransferFactory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });

    it("create2transfer commitment: signature check", async function () {
        const senderIndex = 1;
        const receiverIndex = 2;
        let sender = states[senderIndex];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        const tx = new TxCreate2Transfer(
            senderIndex,
            receiverIndex,
            states[senderIndex].encodePubkey(),
            states[receiverIndex].encodePubkey(),
            states[receiverIndex].pubkeyIndex,
            amount,
            fee,
            sender.nonce,
            USDT
        );

        let aggSignature = mcl.newG1();
        const pubkeysSender = [];
        const pubkeyWitnessesSender = [];
        const pubkeyReceiver = [];
        const pubkeyWitnessesReceiver = [];

        sender = states[tx.fromIndex];
        const receiver = states[tx.toIndex];
        pubkeysSender.push(sender.encodePubkey());
        pubkeyWitnessesSender.push(registry.witness(sender.pubkeyIndex));
        pubkeyReceiver.push(receiver.encodePubkey());
        pubkeyWitnessesReceiver.push(registry.witness(receiver.pubkeyIndex));
        let signature = sender.sign(tx);
        aggSignature = mcl.aggreagate(aggSignature, signature);

        signature = mcl.g1ToHex(aggSignature);

        const txs = [tx];
        const stateTransitionProof = stateTree.applyCreate2TransferBatch(
            txs,
            0
        );
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
            pubkeysSender,
            pubkeyWitnessesSender,
            pubkeysReceiver: pubkeyReceiver,
            pubkeyWitnessesReceiver: pubkeyWitnessesReceiver,
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
        console.log("output", error);
        assert.equal(error, ErrorCode.NoError, `Got ${ErrorCode[error]}`);
        console.log("operation gas cost:", gasCost.toString());
        // const { 1: badSig } = await rollup.callStatic._checkSignature(
        //     signature,
        //     proof,
        //     postStateRoot,
        //     accountRoot,
        //     BAD_DOMAIN,
        //     serialized
        // );
        // assert.equal(badSig, ErrorCode.BadSignature);
        // const checkSigTx = await rollup._checkSignature(
        //     signature,
        //     proof,
        //     postStateRoot,
        //     accountRoot,
        //     DOMAIN,
        //     serialized
        // );
        // const receipt = await checkSigTx.wait();
        // console.log("transaction gas cost:", receipt.gasUsed?.toNumber());
    }).timeout(400000);

    // it("create2trasnfer commitment: processTx", async function() {
    //     const txs = txCreate2TransferFactory(states, COMMIT_SIZE);
    //     for (const tx of txs) {
    //         const preRoot = stateTree.root;
    //         const proof = stateTree.applyTxCreate2Transfer(tx);
    //         assert.isTrue(proof.safe);
    //         const postRoot = stateTree.root;
    //         const { 0: processedRoot, 3: error } = await rollup.testProcessTx(
    //             preRoot,
    //             {
    //                 fromIndex: tx.fromIndex,
    //                 toIndex: tx.toIndex,
    //                 toAccID: tx.toPubkeyIndex,
    //                 amount: tx.amount,
    //                 fee: tx.fee
    //             },
    //             states[0].tokenType,
    //             {
    //                 state: proof.sender,
    //                 witness: proof.senderWitness
    //             },
    //             {
    //                 state: proof.receiver,
    //                 witness: proof.receiverWitness
    //             }
    //         );
    //         assert.equal(error, ErrorCode.NoError, `Got ${ErrorCode[error]}`);
    //         assert.equal(
    //             processedRoot,
    //             postRoot,
    //             "mismatch processed stateroot"
    //         );
    //     }
    // });
    // it("create2transfer commitment: processTransferCommit", async function() {
    //     const txs = txCreate2TransferFactory(states, COMMIT_SIZE);
    //     const feeReceiver = 0;

    //     const preStateRoot = stateTree.root;
    //     const { proof, feeProof, safe } = stateTree.applyCreate2TransferBatch(
    //         txs,
    //         feeReceiver
    //     );
    //     assert.isTrue(safe, "Should be a valid applyTransferBatch");
    //     const stateMerkleProof = [];
    //     for (let i = 0; i < COMMIT_SIZE; i++) {
    //         stateMerkleProof.push({
    //             state: proof[i].sender,
    //             witness: proof[i].senderWitness
    //         });
    //         stateMerkleProof.push({
    //             state: proof[i].receiver,
    //             witness: proof[i].receiverWitness
    //         });
    //     }
    //     stateMerkleProof.push({
    //         state: feeProof.feeReceiver,
    //         witness: feeProof.feeReceiverWitness
    //     });
    //     const postStateRoot = stateTree.root;

    //     const {
    //         0: postRoot,
    //         1: gasCost
    //     } = await rollup.callStatic.testProcessCreate2TransferCommit(
    //         preStateRoot,
    //         serialize(txs),
    //         stateMerkleProof,
    //         states[0].tokenType,
    //         feeReceiver
    //     );
    //     console.log("processTransferBatch gas cost", gasCost.toNumber());
    //     assert.equal(postRoot, postStateRoot, "Mismatch post state root");
    // }).timeout(80000);
});
