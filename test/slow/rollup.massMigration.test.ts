import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { TxMassMigration } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { allContracts } from "../../ts/allContractsInterfaces";
import { assert } from "chai";
import { getGenesisProof, MassMigrationCommitment } from "../../ts/commitments";
import { float16, USDT } from "../../ts/decimal";
import { Result } from "../../ts/interfaces";
import { expectRevert, hexToUint8Array, mineBlocks } from "../../ts/utils";
import { Group, txMassMigrationFactory } from "../../ts/factory";

describe("Mass Migrations", async function() {
    const tokenID = 0;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let DOMAIN: Uint8Array;
    let users: Group;
    let genesisRoot: string;
    const spokeID = 0;
    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        users = Group.new({ n: 32, initialStateID: 0, initialPubkeyID: 0 });
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const initialBalance = USDT.parse("1000");
        users
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: false });

        genesisRoot = stateTree.root;

        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: genesisRoot
        });
        const { rollup, blsAccountRegistry } = contracts;
        DOMAIN = hexToUint8Array(await rollup.appID());
        users.setupSigners(DOMAIN);

        registry = await AccountRegistry.new(blsAccountRegistry);
        for (const user of users.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }
    });

    it("submit a batch and dispute", async function() {
        const { rollup, massMigration } = contracts;
        const feeReceiver = users.getUser(0).stateID;
        const { txs, signature, senders } = txMassMigrationFactory(
            users,
            spokeID
        );
        const preStateRoot = stateTree.root;
        const { proofs } = stateTree.processMassMigrationCommit(
            txs,
            feeReceiver
        );
        const postStateRoot = stateTree.root;
        const { commitment } = MassMigrationCommitment.fromStateProvider(
            registry.root(),
            txs,
            signature,
            feeReceiver,
            stateTree
        );
        const {
            0: processedStateRoot,
            1: result
        } = await massMigration.processMassMigrationCommit(
            preStateRoot,
            TESTING_PARAMS.MAX_TXS_PER_COMMIT,
            commitment.toSolStruct().body,
            proofs
        );
        assert.equal(Result[result], Result[Result.Ok]);
        assert.equal(
            processedStateRoot,
            postStateRoot,
            "should have same state root"
        );

        const targetBatch = commitment.toBatch();

        await targetBatch.submit(rollup, TESTING_PARAMS.STAKE_AMOUNT);

        const batchId = Number(await rollup.nextBatchID()) - 1;
        const batch = await rollup.getBatch(batchId);

        assert.equal(
            batch.commitmentRoot,
            targetBatch.commitmentRoot,
            "mismatch commitment tree root"
        );
        const previousMP = getGenesisProof(genesisRoot);
        const commitmentMP = targetBatch.proof(0);

        await rollup.disputeTransitionMassMigration(
            batchId,
            previousMP,
            commitmentMP,
            proofs
        );

        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    }).timeout(80000);
    it("submit a batch, finalize, and withdraw", async function() {
        const { rollup, withdrawManager, exampleToken, vault } = contracts;
        const feeReceiver = users.getUser(0).stateID;
        const alice = users.getUser(1);
        const aliceState = stateTree.getState(alice.stateID).state;
        const tx = new TxMassMigration(
            alice.stateID,
            USDT.parse("39.99"),
            1,
            USDT.parse("0.01"),
            aliceState.nonce + 1,
            float16
        );
        stateTree.processMassMigrationCommit([tx], feeReceiver);

        const {
            commitment,
            migrationTree
        } = MassMigrationCommitment.fromStateProvider(
            registry.root(),
            [tx],
            alice.sign(tx).sol,
            feeReceiver,
            stateTree
        );

        const batch = commitment.toBatch();
        await batch.submit(rollup, TESTING_PARAMS.STAKE_AMOUNT);

        const batchId = Number(await rollup.nextBatchID()) - 1;

        await expectRevert(
            withdrawManager.processWithdrawCommitment(batchId, batch.proof(0)),
            "Vault: Batch shoould be finalised"
        );

        await mineBlocks(ethers.provider, TESTING_PARAMS.BLOCKS_TO_FINALISE);

        // We cheat here a little bit by sending token to the vault manually.
        // Ideally the tokens of the vault should come from the deposits
        await exampleToken.transfer(vault.address, tx.amount);

        const txProcess = await withdrawManager.processWithdrawCommitment(
            batchId,
            batch.proof(0)
        );
        const receiptProcess = await txProcess.wait();
        console.log(
            "Transaction cost: Process Withdraw Commitment",
            receiptProcess.gasUsed.toNumber()
        );
        const withdrawProof = migrationTree.getWithdrawProof(0);
        const [, claimer] = await ethers.getSigners();
        const claimerAddress = await claimer.getAddress();
        const signature = alice.signRaw(claimerAddress).sol;
        async function claim() {
            return withdrawManager
                .connect(claimer)
                .claimTokens(
                    commitment.withdrawRoot,
                    withdrawProof,
                    alice.pubkey,
                    signature,
                    registry.witness(alice.pubkeyID)
                );
        }
        const firstClaim = await claim();
        const receipt = await firstClaim.wait();
        console.log(
            "Transaction cost: claiming a token",
            receipt.gasUsed.toNumber()
        );
        // Try double claim
        await expectRevert(claim(), "WithdrawManager: Token has been claimed");
    });
});
