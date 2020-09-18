import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { Account } from "../ts/stateAccount";
import { TxMassMigration } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { MassMigrationBatch, MassMigrationCommitment } from "../ts/commitments";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Mass Migrations", async function() {
    const tokenID = 1;
    let Alice: Account;
    let Bob: Account;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let initialBatch: MassMigrationBatch;
    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
    });

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        contracts = await deployAll(accounts[0], TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        Alice = Account.new(-1, tokenID, 10, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        Alice.accountID = await registry.register(Alice.encodePubkey());

        Bob = Account.new(-1, tokenID, 10, 0);
        Bob.setStateID(3);
        Bob.newKeyPair();
        Bob.accountID = await registry.register(Bob.encodePubkey());

        stateTree.createAccount(Alice);
        stateTree.createAccount(Bob);
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
            0,
            5,
            1,
            1,
            Alice.nonce + 1
        );
        const signature = Alice.sign(tx);
        const rollup = contracts.rollup;
        const rollupUtils = contracts.clientUtils;
        const stateRoot = stateTree.root;
        const proof = stateTree.applyMassMigration(tx);
        const txs = ethers.utils.arrayify(tx.encode(true));
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const root = await registry.root();

        const commitment = MassMigrationCommitment.new(
            stateRoot,
            root,
            aggregatedSignature0,
            tx.spokeID,
            ethers.constants.HashZero,
            tokenID,
            tx.amount,
            txs
        );
        const {
            0: postStateRoot,
            1: error
        } = await contracts.massMigration.processMassMigrationCommit(
            stateRoot,
            commitment.toSolStruct().body,
            [
                {
                    pathToAccount: Alice.stateID,
                    account: proof.account,
                    siblings: proof.witness
                }
            ]
        );
        assert.equal(
            postStateRoot,
            stateTree.root,
            "should have same state root"
        );
        assert.equal(error, false, "Should be a safe state transition");
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
                pathToAccount: Alice.stateID,
                account: proof.account,
                siblings: proof.witness
            }
        ]);

        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    });
});
