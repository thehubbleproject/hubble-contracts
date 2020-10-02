import { ethers } from "@nomiclabs/buidler";
import { AccountRegistry } from "../ts/accountTree";
import { txMassMigrationFactory, UserStateFactory } from "../ts/factory";
import { State } from "../ts/state";
import { StateTree } from "../ts/stateTree";
import { randHex } from "../ts/utils";
import {
    LoggerFactory,
    BlsAccountRegistryFactory,
    TestMassMigrationFactory,
    MerkleTreeUtilsFactory
} from "../types/ethers-contracts";
import * as mcl from "../ts/mcl";
import { TestMassMigration } from "../types/ethers-contracts/TestMassMigration";
import { serialize } from "../ts/tx";
import { assert } from "chai";
import { Result } from "../ts/interfaces";

const DOMAIN_HEX = randHex(32);
const STATE_SIZE = 32;
const COMMIT_SIZE = 32;
const STATE_TREE_DEPTH = 32;
const spokeID = 1;

describe("Rollup Mass Migration", () => {
    let rollup: TestMassMigration;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    let states: State[] = [];

    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_HEX);
        const [signer] = await ethers.getSigners();
        const logger = await new LoggerFactory(signer).deploy();
        const registryContract = await new BlsAccountRegistryFactory(
            signer
        ).deploy(logger.address);

        registry = await AccountRegistry.new(registryContract);
        states = UserStateFactory.buildList(STATE_SIZE);
        for (const state of states) {
            await registry.register(state.getPubkey());
        }
    });
    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        const merkleTree = await new MerkleTreeUtilsFactory(signer).deploy(
            STATE_TREE_DEPTH
        );
        rollup = await new TestMassMigrationFactory(signer).deploy(
            merkleTree.address
        );
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        stateTree.createStateBulk(states);
    });

    it("checks signature", async function() {
        const txs = txMassMigrationFactory(states, COMMIT_SIZE, spokeID);
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
        const { safe } = stateTree.applyMassMigrationBatch(txs);
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
        } = await rollup.callStatic.testCheckSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            DOMAIN_HEX,
            spokeID,
            serialized
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
    }).timeout(400000);
});
