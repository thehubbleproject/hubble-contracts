import { LoggerFactory } from "../types/ethers-contracts/LoggerFactory";
import { TestCreate2TransferFactory } from "../types/ethers-contracts/TestCreate2TransferFactory";
import { TestCreate2Transfer } from "../types/ethers-contracts/TestCreate2Transfer";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";
import { serialize, TxCreate2Transfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { StateTree, solProofFromCreate2Transfer } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { randHex } from "../ts/utils";
import { Result } from "../ts/interfaces";
import { txCreate2TransferFactory, UserStateFactory } from "../ts/factory";
import { TestBls } from "../types/ethers-contracts/TestBls";
import { USDT } from "../ts/decimal";
import { TestBlsFactory } from "../types/ethers-contracts/TestBlsFactory";

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
    let bls: TestBls;

    before(async function() {
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
            await registry.register(state.getPubkey());
        }
        bls = await new TestBlsFactory(signer).deploy();
        await bls.deployed();
    });

    beforeEach(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        rollup = await new TestCreate2TransferFactory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });

    it("create2transfer commitment: signature check", async function() {
        // create 32 new states
        let newStates = UserStateFactory.buildList(
            STATE_SIZE,
            states.length,
            states.length
        );
        const txs = txCreate2TransferFactory(states, newStates, COMMIT_SIZE);
        for (const state of newStates) {
            await registry.register(state.getPubkey());
        }

        // concat newstates with the global obj
        states = states.concat(newStates);

        const signatures = [];
        const message = [];
        const pubkeysSender = [];
        const pubkeysReceiver = [];
        const pubkeyWitnessesSender = [];
        const pubkeyWitnessesReceiver = [];

        const stateTransitionProof = stateTree.applyCreate2TransferBatch(
            txs,
            0
        );

        assert.isTrue(stateTransitionProof.safe);

        for (const tx of txs) {
            const sender = states[tx.fromIndex];
            const receiver = states[tx.toIndex];

            pubkeysSender.push(sender.getPubkey());
            pubkeyWitnessesSender.push(registry.witness(sender.pubkeyIndex));

            pubkeysReceiver.push(receiver.getPubkey());
            pubkeyWitnessesReceiver.push(
                registry.witness(receiver.pubkeyIndex)
            );

            const signedObj = sender.signAndReturnMessage(tx);
            signatures.push(signedObj.signature);
            message.push(signedObj.M);
        }

        const signature = mcl.aggreagate(signatures);
        let res = await bls.verifyMultiple(signature, pubkeysSender, message);
        assert.isTrue(res);
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
            pubkeysSender,
            pubkeyWitnessesSender,
            pubkeysReceiver: pubkeysReceiver,
            pubkeyWitnessesReceiver: pubkeyWitnessesReceiver
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
        const checkSigTx = await rollup._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            DOMAIN,
            serialized
        );
        const receipt = await checkSigTx.wait();
        console.log("transaction gas cost:", receipt.gasUsed?.toNumber());
    }).timeout(400000);
    it("create2trasnfer commitment: processTx", async function() {
        let newStates = UserStateFactory.buildList(
            STATE_SIZE,
            states.length,
            states.length
        );

        const txs = txCreate2TransferFactory(states, newStates, COMMIT_SIZE);
        for (const state of newStates) {
            await registry.register(state.getPubkey());
        }

        // concat newstates with the global obj
        states = states.concat(newStates);

        for (const tx of txs) {
            const preRoot = stateTree.root;
            const proof = stateTree.applyTxCreate2Transfer(tx);
            const [senderProof, receiverProof] = solProofFromCreate2Transfer(
                proof
            );
            assert.isTrue(proof.safe);
            const postRoot = stateTree.root;
            const { 0: processedRoot, 3: result } = await rollup.testProcessTx(
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
    }).timeout(80000);;
});
