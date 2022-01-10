import {
    BLSAccountRegistry__factory,
    TestCreate2Transfer,
    TestCreate2Transfer__factory
} from "../../types/ethers-contracts";
import { serialize } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { assert } from "chai";
import { ethers } from "hardhat";
import { hexToUint8Array, randHex } from "../../ts/utils";
import { Result } from "../../ts/interfaces";
import {Group, txCreate2TransferFactory, txTransferFactory} from "../../ts/factory";
import {COMMIT_SIZE, STATE_TREE_DEPTH} from "../../ts/constants";
import { deployKeyless } from "../../ts/deployment/deploy";
import { hashPubkey } from "../../ts/pubkey";
import { BigNumber } from "ethers";

const DOMAIN_HEX = randHex(32);
const DOMAIN = hexToUint8Array(DOMAIN_HEX);
const BAD_DOMAIN = hexToUint8Array(randHex(32));
const tokenID = BigNumber.from(5566);

describe("Rollup Create2Transfer Commitment", () => {
    let rollup: TestCreate2Transfer;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    let usersWithState: Group;
    let usersWithoutState: Group;

    before(async function() {
        this.timeout(100000);
        await mcl.init();
        const [signer] = await ethers.getSigners();
        await deployKeyless(signer, false);
        const registryContract = await new BLSAccountRegistry__factory(
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
        rollup = await new TestCreate2Transfer__factory(signer).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        usersWithState.connect(stateTree);
        usersWithState.createStates({ tokenID: tokenID.toNumber() });
    });

    it("create2transfer commitment: signature check", async function() {
        const { txs, signature } = txCreate2TransferFactory(
            usersWithState,
            usersWithoutState
        );

        const pubkeysSender = usersWithState.getPubkeys();
        const pubkeyHashesReceiver = usersWithoutState
            .getPubkeys()
            .map(hashPubkey);
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
            pubkeyHashesReceiver,
            pubkeyWitnessesReceiver
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
    it("transfer commitment: signature check, with 2 more tx from same sender", async function() {
        const fewSenderGroup = usersWithState.slice(5);
        const { txs, signature, senders } = txCreate2TransferFactory(
            fewSenderGroup,
            usersWithoutState
        );
        const pubkeysSender = senders.map(sender => sender.pubkey);
        const pubkeyHashesReceiver = usersWithoutState
            .getPubkeys()
            .map(hashPubkey);
        const pubkeyWitnessesSender = senders.map(sender =>
            registry.witness(sender.pubkeyID)
        );
        const pubkeyWitnessesReceiver = usersWithoutState
            .getPubkeyIDs()
            .map(pubkeyID => registry.witness(pubkeyID));
        stateTree.processCreate2TransferCommit(txs, 0);

        const postProofs = txs.map(tx => stateTree.getState(tx.fromIndex));
        const proof = {
            states: postProofs.map(proof => proof.state),
            stateWitnesses: postProofs.map(proof => proof.witness),
            pubkeysSender,
            pubkeyWitnessesSender,
            pubkeyHashesReceiver,
            pubkeyWitnessesReceiver
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

    it("returns invalid post state root result", async function() {
        const { txs } = txCreate2TransferFactory(
            usersWithState,
            usersWithoutState
        );
        const feeReceiver = 0;

        const preStateRoot = stateTree.root;
        const { proofs } = stateTree.processCreate2TransferCommit(txs, feeReceiver);

        const [
            gasCost,
            result
        ] = await rollup.callStatic.testProcessCreate2TransferCommit(
            preStateRoot,
            preStateRoot,
            COMMIT_SIZE,
            feeReceiver,
            serialize(txs),
            proofs
        );
        console.log("processCreate2TransferCommit gas cost", gasCost.toNumber());
        assert.equal(result, Result.InvalidPostStateRoot, `Got ${Result[result]}`);
    }).timeout(80000);
});
