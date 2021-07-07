import {
    TestTransfer,
    TestTransfer__factory,
    BLSAccountRegistry__factory
} from "../../types/ethers-contracts";
import { serialize } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { assert } from "chai";
import { ethers } from "hardhat";
import { hexToUint8Array, randHex } from "../../ts/utils";
import { Result } from "../../ts/interfaces";
import { Group, txTransferFactory } from "../../ts/factory";
import { STATE_TREE_DEPTH, COMMIT_SIZE } from "../../ts/constants";
import { deployKeyless } from "../../ts/deployment/deploy";

const DOMAIN_HEX = randHex(32);
const DOMAIN = hexToUint8Array(DOMAIN_HEX);
const BAD_DOMAIN = hexToUint8Array(randHex(32));
const tokenID = 5566;

describe("Rollup Transfer Commitment", () => {
    let rollup: TestTransfer;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    let users: Group;

    before(async function() {
        this.timeout(100000);
        await mcl.init();
        const [signer] = await ethers.getSigners();
        await deployKeyless(signer, false);
        const registryContract = await new BLSAccountRegistry__factory(
            signer
        ).deploy();

        registry = await AccountRegistry.new(registryContract);
        users = Group.new({ n: 32, domain: DOMAIN });
        for (const user of users.userIterator()) {
            await registry.register(user.pubkey);
        }
    });

    beforeEach(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        rollup = await new TestTransfer__factory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        users.connect(stateTree);
        await users.createStates({ tokenID });
    });

    it("transfer commitment: signature check", async function() {
        const { txs, signature, senders } = await txTransferFactory(
            users,
            COMMIT_SIZE
        );
        const pubkeys = senders.map(sender => sender.pubkey);
        const pubkeyWitnesses = await Promise.all(
            senders.map(sender => registry.witness(sender.pubkeyID))
        );

        await stateTree.processTransferCommit(txs, 0);
        const serialized = serialize(txs);

        // Need post stateWitnesses
        const postProofs = await Promise.all(
            txs.map(tx => stateTree.getState(tx.fromIndex))
        );

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
    it("transfer commitment: signature check, with 2 more tx from same sender", async function() {
        const fewSenderGroup = users.slice(3);
        const { txs, signature, senders } = await txTransferFactory(
            fewSenderGroup,
            COMMIT_SIZE
        );
        const pubkeys = senders.map(sender => sender.pubkey);
        const pubkeyWitnesses = await Promise.all(
            senders.map(sender => registry.witness(sender.pubkeyID))
        );

        await stateTree.processTransferCommit(txs, 0);

        const postProofs = await Promise.all(
            txs.map(tx => stateTree.getState(tx.fromIndex))
        );
        const proof = {
            states: postProofs.map(proof => proof.state),
            stateWitnesses: postProofs.map(proof => proof.witness),
            pubkeys,
            pubkeyWitnesses
        };
        const {
            0: gasCost,
            1: result
        } = await rollup.callStatic._checkSignature(
            signature,
            proof,
            stateTree.root,
            registry.root(),
            DOMAIN,
            serialize(txs)
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);
        console.log("operation gas cost:", gasCost.toString());
    }).timeout(400000);
    it("transfer commitment: processTx", async function() {
        const { txs } = await txTransferFactory(users, COMMIT_SIZE);
        for (const tx of txs) {
            const preRoot = stateTree.root;
            const [
                senderProof,
                receiverProof
            ] = await stateTree.processTransfer(tx, tokenID);
            const postRoot = stateTree.root;
            const {
                0: processedRoot,
                1: result
            } = await rollup.testProcessTransfer(
                preRoot,
                tx,
                tokenID,
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
        const { txs } = await txTransferFactory(users, COMMIT_SIZE);
        const feeReceiver = 0;

        const preStateRoot = stateTree.root;
        const { proofs } = await stateTree.processTransferCommit(
            txs,
            feeReceiver
        );
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
