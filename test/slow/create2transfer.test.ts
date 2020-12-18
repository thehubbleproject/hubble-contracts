import { TestCreate2TransferFactory } from "../types/ethers-contracts/TestCreate2TransferFactory";
import { TestCreate2Transfer } from "../types/ethers-contracts/TestCreate2Transfer";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";
import { serialize } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { assert } from "chai";
import { ethers } from "hardhat";
import { hexToUint8Array, randHex } from "../ts/utils";
import { Result } from "../ts/interfaces";
import { Group, txCreate2TransferFactory } from "../ts/factory";

const DOMAIN_HEX = randHex(32);
const DOMAIN = hexToUint8Array(DOMAIN_HEX);
const BAD_DOMAIN = hexToUint8Array(randHex(32));
const STATE_TREE_DEPTH = 32;
const tokenID = 5566;

describe("Rollup Create2Transfer Commitment", () => {
    let rollup: TestCreate2Transfer;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    let usersWithState: Group;
    let usersWithoutState: Group;

    before(async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        const registryContract = await new BlsAccountRegistryFactory(
            signer
        ).deploy();

        registry = await AccountRegistry.new(registryContract);
        const nUsersWithStates = 32;
        const nUserWithoutState = nUsersWithStates;
        usersWithState = Group.new({
            n: nUsersWithStates,
            initialStateID: 0,
            initialPubkeyID: 0,
            domain: DOMAIN
        });
        usersWithoutState = Group.new({
            n: nUserWithoutState,
            initialStateID: nUsersWithStates,
            initialPubkeyID: nUsersWithStates,
            domain: DOMAIN
        });

        for (const user of usersWithState.userIterator()) {
            await registry.register(user.pubkey);
        }
        for (const user of usersWithoutState.userIterator()) {
            await registry.register(user.pubkey);
        }
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        rollup = await new TestCreate2TransferFactory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        usersWithState.connect(stateTree);
        usersWithState.createStates({ tokenID });
    });

    it("create2transfer commitment: signature check", async function() {
        const { txs, signature } = txCreate2TransferFactory(
            usersWithState,
            usersWithoutState
        );

        const pubkeysSender = usersWithState.getPubkeys();
        const pubkeysReceiver = usersWithoutState.getPubkeys();
        const pubkeyWitnessesSender = usersWithState
            .getPubkeyIDs()
            .map(pubkeyID => registry.witness(pubkeyID));
        const pubkeyWitnessesReceiver = usersWithoutState
            .getPubkeyIDs()
            .map(pubkeyID => registry.witness(pubkeyID));

        stateTree.processCreate2TransferCommit(txs, 0);

        const serialized = serialize(txs);

        const postProofs = txs.map(tx => stateTree.getState(tx.fromIndex));

        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();

        const proof = {
            states: postProofs.map(proof => proof.state),
            stateWitnesses: postProofs.map(proof => proof.witness),
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
    }).timeout(800000);
    it("create2trasnfer commitment: processTx", async function() {
        const { txs } = txCreate2TransferFactory(
            usersWithState,
            usersWithoutState
        );

        for (const tx of txs) {
            const preRoot = stateTree.root;
            const [
                senderProof,
                receiverProof
            ] = stateTree.processCreate2Transfer(tx, tokenID);
            const postRoot = stateTree.root;
            const {
                0: processedRoot,
                1: result
            } = await rollup.testProcessCreate2Transfer(
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
});
