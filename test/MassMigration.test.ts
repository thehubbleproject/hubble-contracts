import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { TxMassMigration } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { MassMigrationBatch, MassMigrationCommitment } from "../ts/commitments";
import { USDT } from "../ts/decimal";
import { Result } from "../ts/interfaces";
import { solidityKeccak256 } from "ethers/lib/utils";
import { Tree } from "../ts/tree";
import { getMerkleRootFromLeaves } from "../ts/utils";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Mass Migrations", async function() {
    const tokenID = 1;
    let Alice: State;
    let Bob: State;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let initialBatch: MassMigrationBatch;
    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
    });

    beforeEach(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        contracts = await deployAll(signer, TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        const initialBalance = USDT.castInt(1000.0);
        Alice = State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        Alice.pubkeyIndex = await registry.register(Alice.getPubkey());

        Bob = State.new(-1, tokenID, initialBalance, 0);
        Bob.setStateID(3);
        Bob.newKeyPair();
        Bob.pubkeyIndex = await registry.register(Bob.getPubkey());

        stateTree.createState(Alice);
        stateTree.createState(Bob);
        const accountRoot = await registry.root();
        const initialCommitment = MassMigrationCommitment.new(
            stateTree.root,
            accountRoot
        );
        initialBatch = initialCommitment.toBatch();
        // We submit a batch that has a stateRoot containing Alice and Bob
        await initialBatch.submit(
            contracts.rollup,
            TESTING_PARAMS.STAKE_AMOUNT
        );
    });

    it("submit a batch and dispute", async function() {
        const tx = new TxMassMigration(
            Alice.stateID,
            USDT.castInt(39.99),
            1,
            USDT.castInt(0.01),
            Alice.nonce + 1,
            USDT
        );
        const signature = Alice.sign(tx);
        const rollup = contracts.rollup;
        const stateRoot = stateTree.root;
        const proof = stateTree.applyMassMigration(tx);
        assert.isTrue(proof.safe);
        const txs = tx.encode();
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const root = await registry.root();

        const leaf = solidityKeccak256(
            ["uint256", "uint256"],
            [Alice.pubkeyIndex, tx.amount]
        );
        const withdrawRoot = Tree.merklize([leaf]).root;

        const commitment = MassMigrationCommitment.new(
            stateRoot,
            root,
            aggregatedSignature0,
            tx.spokeID,
            withdrawRoot,
            tokenID,
            tx.amount,
            txs
        );
        const {
            0: postStateRoot,
            1: result
        } = await contracts.massMigration.processMassMigrationCommit(
            stateRoot,
            commitment.toSolStruct().body,
            [
                {
                    state: proof.state,
                    witness: proof.witness
                }
            ]
        );
        assert.equal(
            postStateRoot,
            stateTree.root,
            "should have same state root"
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);
        commitment.stateRoot = postStateRoot;

        const targetBatch = commitment.toBatch();

        await targetBatch.submit(rollup, TESTING_PARAMS.STAKE_AMOUNT);

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        const batch = await rollup.getBatch(batchId);

        assert.equal(
            batch.commitmentRoot,
            targetBatch.commitmentRoot,
            "mismatch commitment tree root"
        );
        const previousMP = initialBatch.proofCompressed(0);
        const commitmentMP = targetBatch.proof(0);

        await rollup.disputeMMBatch(batchId, previousMP, commitmentMP, [
            {
                state: proof.state,
                witness: proof.witness
            }
        ]);

        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    });
});
