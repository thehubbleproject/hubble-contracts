import { assert, expect } from "chai";
import { ethers } from "hardhat";
import { TESTING_PARAMS } from "../../ts/constants";
import { randHex } from "../../ts/utils";
import {
    MockDepositManagerFactory,
    TestRollupFactory
} from "../../types/ethers-contracts";
import { MockDepositManager } from "../../types/ethers-contracts/MockDepositManager";
import { TestRollup } from "../../types/ethers-contracts/TestRollup";

describe("Rollback", function() {
    let rollup: TestRollup;
    let depositManager: MockDepositManager;
    const param = TESTING_PARAMS;
    const numOfBatches = 250;

    async function getTipBatchID() {
        return Number(await rollup.nextBatchID()) - 1;
    }

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        depositManager = await new MockDepositManagerFactory(signer).deploy();
        rollup = await new TestRollupFactory(signer).deploy(
            depositManager.address,
            param.STAKE_AMOUNT,
            param.BLOCKS_TO_FINALISE,
            param.MIN_GAS_LEFT
        );
        for (let i = 0; i < numOfBatches; i++) {
            if (i % 2 == 0) {
                await rollup.submitDeposits(randHex(32), {
                    value: param.STAKE_AMOUNT
                });
            } else {
                await rollup.submitDummyBatch({ value: param.STAKE_AMOUNT });
            }
        }
    });
    it("Test rollback exactly 1 batch", async function() {
        assert.equal(await getTipBatchID(), numOfBatches - 1);
        // Set gasLimit manually since estimateGas gets one that can slash no batch.
        await rollup.testRollback(numOfBatches - 1, { gasLimit: 1000000 });
        assert.equal(await getTipBatchID(), numOfBatches - 2);
        assert.equal(Number(await rollup.invalidBatchMarker()), 0);
    });
    it("profile gas usage out of the loop", async function() {
        // Set a high minGasLeft to skip loop
        await rollup.setMinGasLeft("12000000");
        const gasleft = await rollup.callStatic.testRollback(1);
        console.log("Gas usage out of the loop", gasleft.toNumber());
    });

    it("Test a long rollback", async function() {
        const nBatches = await getTipBatchID();
        const tx = await rollup.testRollback(1, { gasLimit: 9500000 });
        // Want to roll all the way to the start
        assert.equal(await getTipBatchID(), 0);
        const gasUsed = (await tx.wait()).gasUsed.toNumber();
        console.log(`Rolled back ${nBatches} batches with ${gasUsed} gas`);
        console.log("gas per batch rolled back", gasUsed / nBatches);
    });
    it("Test keep rolling back", async function() {
        const tipBatchID = numOfBatches - 1;
        const badBatchID = tipBatchID - 20;
        const goodBatchID = badBatchID - 1;

        await rollup.testRollback(badBatchID, { gasLimit: 500000 });
        expect(await getTipBatchID()).to.be.greaterThan(badBatchID);

        await rollup.keepRollingBack({ gasLimit: 8000000 });
        assert.equal(Number(await rollup.invalidBatchMarker()), 0);
        assert.equal(await getTipBatchID(), goodBatchID);
    });
    it("Test rollback with deposits", async function() {
        const badBatchID = await getTipBatchID();
        const [subtree1, subtree2, subtree3] = [
            randHex(32),
            randHex(32),
            randHex(32)
        ];
        await rollup.submitDeposits(subtree1, { value: param.STAKE_AMOUNT });
        await rollup.submitDummyBatch({ value: param.STAKE_AMOUNT });
        await rollup.submitDeposits(subtree2, { value: param.STAKE_AMOUNT });
        await rollup.submitDummyBatch({ value: param.STAKE_AMOUNT });
        await rollup.submitDeposits(subtree3, { value: param.STAKE_AMOUNT });
        const tx = await rollup.testRollback(badBatchID, { gasLimit: 1000000 });
        const events = await depositManager.queryFilter(
            depositManager.filters.EnqueSubtree(null),
            tx.blockHash
        );
        assert.equal(events.length, 3);
        const [event1, event2, event3] = events;
        // Since we are rolling "back", the events are emitted in reverse order
        assert.equal(event1.args?.subtreeRoot, subtree3);
        assert.equal(event2.args?.subtreeRoot, subtree2);
        assert.equal(event3.args?.subtreeRoot, subtree1);
    });
});
