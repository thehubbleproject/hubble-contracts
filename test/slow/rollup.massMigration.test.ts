import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { TxMassMigration } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { allContracts } from "../../ts/allContractsInterfaces";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { getGenesisProof, MassMigrationCommitment } from "../../ts/commitments";
import { CommonToken } from "../../ts/decimal";
import { Result } from "../../ts/interfaces";
import { hexToUint8Array, mineBlocks } from "../../ts/utils";
import { expectRevert } from "../../test/utils";
import { Group, txMassMigrationFactory, User } from "../../ts/factory";
import { deployKeyless } from "../../ts/deployment/deploy";
import { handleNewBatch } from "../../ts/client/batchHandler";
import { Rollup, WithdrawManager } from "../../types/ethers-contracts";
import { XCommitmentInclusionProof } from "../../ts/client/features/interface";

chai.use(chaiAsPromised);

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
        users = Group.new({ n: 30, initialStateID: 0, initialPubkeyID: 0 });
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        // The example token is 18 decimals
        const initialBalance = CommonToken.fromHumanValue("1000").l2Value;
        users
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: false });

        const usersWithDifferentPubkeyIDs = users;

        let usersWithTheSamePubkeyID = Group.new({
            n: 2,
            initialStateID: 30,
            initialPubkeyID: 0
        });
        usersWithTheSamePubkeyID
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: false });
        users = users.join(usersWithTheSamePubkeyID);

        genesisRoot = stateTree.root;

        await deployKeyless(signer, false);
        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: genesisRoot
        });
        const { rollup, blsAccountRegistry } = contracts;
        DOMAIN = hexToUint8Array(await rollup.domainSeparator());
        users.setupSigners(DOMAIN);

        registry = await AccountRegistry.new(blsAccountRegistry);
        for (const user of usersWithDifferentPubkeyIDs.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }
    });

    async function createAndSubmitBatch(
        rollup: Rollup,
        batchId: number,
        user: User
    ) {
        const feeReceiver = users.getUser(0).stateID;
        const userState = stateTree.getState(user.stateID).state;

        const tx = new TxMassMigration(
            user.stateID,
            CommonToken.fromHumanValue("39.99").l2Value,
            1,
            CommonToken.fromHumanValue("0.01").l2Value,
            userState.nonce.add(1).toNumber()
        );
        stateTree.processMassMigrationCommit([tx], feeReceiver);

        const {
            commitment,
            migrationTree
        } = MassMigrationCommitment.fromStateProvider(
            registry.root(),
            [tx],
            user.sign(tx).sol,
            feeReceiver,
            stateTree
        );

        const batch = commitment.toBatch();
        await batch.submit(rollup, batchId, TESTING_PARAMS.STAKE_AMOUNT);

        return { tx, commitment, migrationTree };
    }

    async function verifyProcessWithdrawCommitment(
        withdrawManager: WithdrawManager,
        batchId: number,
        proof: XCommitmentInclusionProof
    ) {
        const txProcess = await withdrawManager.processWithdrawCommitment(
            batchId,
            proof
        );
        const receiptProcess = await txProcess.wait();
        console.log(
            "Transaction cost: Process Withdraw Commitment",
            receiptProcess.gasUsed.toNumber()
        );

        await expectRevert(
            withdrawManager.processWithdrawCommitment(batchId, proof),
            "WithdrawManager: commitment was already processed"
        );
    }

    it("fails if batchID is incorrect", async function() {
        const feeReceiver = users.getUser(0).stateID;
        const { txs, signature } = txMassMigrationFactory(users, spokeID);

        const { commitment } = MassMigrationCommitment.fromStateProvider(
            registry.root(),
            txs,
            signature,
            feeReceiver,
            stateTree
        );
        const batch = commitment.toBatch();

        const invalidBatchID = 42;
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
        const { rollup, massMigration } = contracts;
        const feeReceiver = users.getUser(0).stateID;
        const { txs, signature } = txMassMigrationFactory(users, spokeID);
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
        const result = await massMigration.processMassMigrationCommit(
            preStateRoot,
            postStateRoot,
            TESTING_PARAMS.MAX_TXS_PER_COMMIT,
            commitment.toSolStruct().body,
            proofs
        );
        assert.equal(result, Result.Ok, `Got ${Result[result]}`);

        const targetBatch = commitment.toBatch();
        const mMBatchID = 1;
        const _txSubmit = await targetBatch.submit(
            rollup,
            mMBatchID,
            TESTING_PARAMS.STAKE_AMOUNT
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

        await rollup.disputeTransitionMassMigration(
            batchID,
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
        const alice = users.getUser(1);

        const batchId = Number(await rollup.nextBatchID());

        const {
            tx,
            commitment,
            migrationTree
        } = await createAndSubmitBatch(rollup, batchId, alice);

        const batch = commitment.toBatch();

        await expectRevert(
            withdrawManager.processWithdrawCommitment(batchId, batch.proof(0)),
            "Vault: Batch should be finalised"
        );

        await mineBlocks(ethers.provider, TESTING_PARAMS.BLOCKS_TO_FINALISE);

        // We cheat here a little bit by sending token to the vault manually.
        // Ideally the tokens of the vault should come from the deposits
        await exampleToken.transfer(
            vault.address,
            CommonToken.fromL2Value(tx.amount).l1Value
        );

        await verifyProcessWithdrawCommitment(
            withdrawManager,
            batchId,
            batch.proof(0)
        );

        const withdrawProof = migrationTree.getWithdrawProof(alice.stateID, 0);
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

    it("verifies absence of withdraw root collisions", async function() {
        const { rollup, withdrawManager, exampleToken, vault } = contracts;

        const alice = users.getUser(1);
        const aliceClone = users.getUser(31);
        assert.equal(alice.pubkeyID, aliceClone.pubkeyID);
        assert.notEqual(alice.stateID, aliceClone.stateID);

        const {
            tx: tx1,
            commitment: commitment1
        } = await createAndSubmitBatch(rollup, 1, alice);
        const {
            commitment: commitment2
        } = await createAndSubmitBatch(rollup, 2, aliceClone);

        await mineBlocks(ethers.provider, TESTING_PARAMS.BLOCKS_TO_FINALISE);

        // We cheat here a little bit by sending token to the vault manually.
        // Ideally the tokens of the vault should come from the deposits
        await exampleToken.transfer(
            vault.address,
            CommonToken.fromL2Value(tx1.amount).l1Value.mul(2)
        );

        await verifyProcessWithdrawCommitment(
            withdrawManager,
            1,
            commitment1.toBatch().proof(0)
        );
        await verifyProcessWithdrawCommitment(
            withdrawManager,
            2,
            commitment2.toBatch().proof(0)
        );
    });
});
