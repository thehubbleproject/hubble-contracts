import { ethers } from "hardhat";
import { AccountRegistry } from "../../ts/accountTree";
import { Group, txMassMigrationFactory } from "../../ts/factory";
import { StateTree } from "../../ts/stateTree";
import { hexToUint8Array, randHex } from "../../ts/utils";
import {
    BlsAccountRegistryFactory,
    TestMassMigrationFactory
} from "../../types/ethers-contracts";
import * as mcl from "../../ts/mcl";
import { TestMassMigration } from "../../types/ethers-contracts/TestMassMigration";
import { serialize } from "../../ts/tx";
import { assert } from "chai";
import { Result } from "../../ts/interfaces";
import { constants } from "ethers";
import { MassMigrationCommitment } from "../../ts/commitments";
import {
    EMPTY_SIGNATURE,
    STATE_TREE_DEPTH,
    COMMIT_SIZE
} from "../../ts/constants";
import { deployKeyless } from "../../ts/deployment/deploy";

const DOMAIN = hexToUint8Array(randHex(32));
const tokenID = 5566;
const spokeID = 1;

describe("Rollup Mass Migration", () => {
    let rollup: TestMassMigration;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    let users: Group;

    before(async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        await deployKeyless(signer, false);
        const registryContract = await new BlsAccountRegistryFactory(
            signer
        ).deploy();

        registry = await AccountRegistry.new(registryContract);
        users = Group.new({ n: 32, domain: DOMAIN });
        for (const user of users.userIterator()) {
            await registry.register(user.pubkey);
        }
    });
    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        rollup = await new TestMassMigrationFactory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        users.connect(stateTree);
        users.createStates({ tokenID });
    });

    it("checks signature", async function() {
        const { txs, signature, senders } = txMassMigrationFactory(
            users,
            spokeID
        );
        const pubkeys = senders.map(sender => sender.pubkey);
        const pubkeyWitnesses = senders.map(sender =>
            registry.witness(sender.pubkeyID)
        );
        stateTree.processMassMigrationCommit(txs, 0);
        const serialized = serialize(txs);

        // Need post stateWitnesses
        const postProofs = txs.map(tx => stateTree.getState(tx.fromIndex));

        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();

        const proof = {
            states: postProofs.map(proof => proof.state),
            stateWitnesses: postProofs.map(proof => proof.witness),
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
            DOMAIN,
            spokeID,
            serialized
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
    }).timeout(400000);
    it("checks signature: same sender", async function() {
        const smallGroup = users.slice(4);
        let manySameSenderGroup = smallGroup;
        for (let i = 0; i < 7; i++) {
            manySameSenderGroup = manySameSenderGroup.join(smallGroup);
        }
        const { txs, signature, senders } = txMassMigrationFactory(
            manySameSenderGroup,
            spokeID
        );
        const pubkeys = senders.map(sender => sender.pubkey);
        const pubkeyWitnesses = senders.map(sender =>
            registry.witness(sender.pubkeyID)
        );
        stateTree.processMassMigrationCommit(txs, 0);
        const serialized = serialize(txs);

        // Need post stateWitnesses
        const postProofs = txs.map(tx => stateTree.getState(tx.fromIndex));

        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();

        const proof = {
            states: postProofs.map(proof => proof.state),
            stateWitnesses: postProofs.map(proof => proof.witness),
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
            DOMAIN,
            spokeID,
            serialized
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
    }).timeout(800000);

    it("checks state transitions", async function() {
        const { txs } = txMassMigrationFactory(users, spokeID);
        const feeReceiver = 0;

        const preStateRoot = stateTree.root;
        const { proofs } = stateTree.processMassMigrationCommit(
            txs,
            feeReceiver
        );
        const postStateRoot = stateTree.root;
        const { commitment } = MassMigrationCommitment.fromStateProvider(
            constants.HashZero,
            txs,
            EMPTY_SIGNATURE,
            feeReceiver,
            stateTree
        );

        const {
            0: gasCost,
            1: postRoot,
            2: result
        } = await rollup.callStatic.testProcessMassMigrationCommit(
            preStateRoot,
            COMMIT_SIZE,
            commitment.toSolStruct().body,
            proofs
        );
        console.log("processTransferBatch gas cost", gasCost.toNumber());
        assert.equal(postRoot, postStateRoot, "Mismatch post state root");
        assert.equal(Result[result], Result[Result.Ok]);
    }).timeout(80000);
});
