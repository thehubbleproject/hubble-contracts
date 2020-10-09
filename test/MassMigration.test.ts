import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { TxMassMigration } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert, expect } from "chai";
import { MassMigrationBatch, MassMigrationCommitment } from "../ts/commitments";
import { USDT } from "../ts/decimal";
import { Result } from "../ts/interfaces";
import { Tree } from "../ts/tree";
import { mineBlocks } from "../ts/utils";

describe("Mass Migrations", async function() {
    const tokenID = 1;
    let Alice: State;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let initialBatch: MassMigrationBatch;
    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        contracts = await deployAll(signer, TESTING_PARAMS);
        mcl.setDomainHex(await contracts.rollup.APP_ID());

        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        const initialBalance = USDT.castInt(1000.0);
        Alice = State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        Alice.pubkeyIndex = await registry.register(Alice.getPubkey());

        stateTree.createState(Alice);
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

        const leaf = State.new(
            Alice.pubkeyIndex,
            tokenID,
            tx.amount,
            0
        ).toStateLeaf();
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
            [{ state: proof.state, witness: proof.witness }]
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
            { state: proof.state, witness: proof.witness }
        ]);

        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    });
    it("submit a batch, finalize, and withdraw", async function() {
        const tx = new TxMassMigration(
            Alice.stateID,
            USDT.castInt(39.99),
            1,
            USDT.castInt(0.01),
            Alice.nonce + 1,
            USDT
        );
        const leaf = State.new(
            Alice.pubkeyIndex,
            tokenID,
            tx.amount,
            0
        ).toStateLeaf();
        const withdrawTree = Tree.merklize([leaf]);
        const { safe } = stateTree.applyMassMigrationBatch([tx]);
        assert.isTrue(safe);

        const commitment = MassMigrationCommitment.new(
            stateTree.root,
            await registry.root(),
            mcl.aggreagate([Alice.sign(tx)]),
            tx.spokeID,
            withdrawTree.root,
            tokenID,
            tx.amount,
            tx.encode()
        );

        const batch = commitment.toBatch();
        await batch.submit(contracts.rollup, TESTING_PARAMS.STAKE_AMOUNT);

        const batchId =
            Number(await contracts.rollup.numOfBatchesSubmitted()) - 1;

        await expect(
            contracts.withdrawManager.ProcessWithdrawCommitment(
                batchId,
                batch.proof(0)
            )
        ).revertedWith("Vault: Batch shoould be finalised");

        await mineBlocks(ethers.provider, TESTING_PARAMS.TIME_TO_FINALISE);

        // We cheat here a little bit by sending token to the vault manually.
        // Ideally the tokens of the vault should come from the deposits
        await contracts.testToken.transfer(contracts.vault.address, tx.amount);

        await contracts.withdrawManager.ProcessWithdrawCommitment(
            batchId,
            batch.proof(0)
        );
        const withdrawal = withdrawTree.witness(0);
        const [, claimer] = await ethers.getSigners();
        const claimerAddress = await claimer.getAddress();
        const { signature } = mcl.sign(claimerAddress, Alice.secretKey);
        const state = {
            pubkeyIndex: Alice.pubkeyIndex,
            tokenType: tokenID,
            balance: tx.amount,
            nonce: 0
        };
        const withdrawProof = {
            state,
            path: withdrawal.index,
            witness: withdrawal.nodes
        };
        await contracts.withdrawManager
            .connect(claimer)
            .ClaimTokens(
                commitment.withdrawRoot,
                withdrawProof,
                Alice.publicKey,
                mcl.g1ToHex(signature),
                registry.witness(Alice.pubkeyIndex)
            );
        await expect(
            contracts.withdrawManager
                .connect(claimer)
                .ClaimTokens(
                    commitment.withdrawRoot,
                    withdrawProof,
                    Alice.publicKey,
                    mcl.g1ToHex(signature),
                    registry.witness(Alice.pubkeyIndex)
                )
        ).revertedWith("WithdrawManager: Token has been claimed");
    });
});
