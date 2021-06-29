import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { serialize } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { allContracts } from "../../ts/allContractsInterfaces";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import {
    Create2TransferCommitment,
    getGenesisProof
} from "../../ts/commitments";
import { USDT } from "../../ts/decimal";
import { hexToUint8Array } from "../../ts/utils";
import { Group, txCreate2TransferFactory } from "../../ts/factory";
import { deployKeyless } from "../../ts/deployment/deploy";
import { handleNewBatch } from "../../ts/client/batchHandler";

chai.use(chaiAsPromised);

const DOMAIN = hexToUint8Array(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

describe("Rollup Create2Transfer", async function() {
    const tokenID = 1;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let usersWithStates: Group;
    let usersWithoutState: Group;
    let genesisRoot: string;

    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();

        const nUsersWithStates = 32;
        usersWithStates = Group.new({
            n: nUsersWithStates,
            initialStateID: 0,
            initialPubkeyID: 0,
            domain: DOMAIN
        });
        usersWithoutState = Group.new({
            n: 32,
            initialStateID: nUsersWithStates,
            initialPubkeyID: nUsersWithStates,
            domain: DOMAIN
        });
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);

        const initialBalance = USDT.fromHumanValue("55.6").l2Value;
        usersWithStates
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: true });

        genesisRoot = stateTree.root;

        await deployKeyless(signer, false);
        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: genesisRoot
        });

        registry = await AccountRegistry.new(contracts.blsAccountRegistry);

        for (const user of usersWithStates.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }
        for (const user of usersWithoutState.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }
    });

    it("fails if batchID is incorrect", async function() {
        const feeReceiver = usersWithStates.getUser(0).stateID;
        const { txs, signature } = txCreate2TransferFactory(
            usersWithStates,
            usersWithoutState
        );

        const root = registry.root();
        const commit = Create2TransferCommitment.new(
            stateTree.root,
            root,
            signature,
            feeReceiver,
            serialize(txs)
        );
        const batch = commit.toBatch();

        const invalidBatchID = 420;
        await assert.isRejected(
            batch.submit(
                contracts.rollup,
                invalidBatchID,
                TESTING_PARAMS.STAKE_AMOUNT
            ),
            /.*batchID does not match nextBatchID.*/
        );
    });

    it("submit a batch and dispute", async function() {
        const feeReceiver = usersWithStates.getUser(0).stateID;
        const { rollup } = contracts;

        const { txs, signature } = txCreate2TransferFactory(
            usersWithStates,
            usersWithoutState
        );

        const { proofs } = stateTree.processCreate2TransferCommit(
            txs,
            feeReceiver
        );
        const postStateRoot = stateTree.root;
        const serialized = serialize(txs);

        const root = registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");

        const commitment = Create2TransferCommitment.new(
            postStateRoot,
            root,
            signature,
            feeReceiver,
            serialized
        );

        const targetBatch = commitment.toBatch();
        const c2TBatchID = 1;
        const _txSubmit = await targetBatch.submit(
            rollup,
            c2TBatchID,
            TESTING_PARAMS.STAKE_AMOUNT
        );
        console.log(
            "submitBatch execution cost",
            (await _txSubmit.wait()).gasUsed.toNumber()
        );
        const [event] = await rollup.queryFilter(
            rollup.filters.NewBatch(null, null, null),
            _txSubmit.blockHash
        );
        const parsedBatch = await handleNewBatch(event, rollup);

        const batchID = event.args?.batchID;

        assert.equal(
            parsedBatch.commitmentRoot,
            targetBatch.commitmentRoot,
            "mismatch commitment tree root"
        );
        const previousMP = getGenesisProof(genesisRoot);
        const commitmentMP = targetBatch.proof(0);

        const _tx = await rollup.disputeTransitionCreate2Transfer(
            batchID,
            previousMP,
            commitmentMP,
            proofs
        );
        const receipt = await _tx.wait();
        console.log("disputeBatch execution cost", receipt.gasUsed.toNumber());
        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    }).timeout(120000);
});
