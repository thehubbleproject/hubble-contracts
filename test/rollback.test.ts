import { assert, expect } from "chai";
import { ethers } from "hardhat";
import { TESTING_PARAMS } from "../ts/constants";
import { LoggerFactory, TestRollupFactory } from "../types/ethers-contracts";
import { TestRollup } from "../types/ethers-contracts/TestRollup";

describe("Rollback", function() {
    let rollup: TestRollup;
    const param = TESTING_PARAMS;
    const numOfBatches = 250;

    async function getTipBatchID() {
        return Number(await rollup.numOfBatchesSubmitted()) - 1;
    }

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        const logger = await new LoggerFactory(signer).deploy();
        rollup = await new TestRollupFactory(signer).deploy(
            logger.address,
            param.STAKE_AMOUNT,
            param.BLOCKS_TO_FINALISE,
            param.MIN_GAS_LEFT
        );
        for (let i = 0; i < numOfBatches; i++) {
            await rollup.submitDummyBatch({ value: param.STAKE_AMOUNT });
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

    for (const gasLimit of [500000, 1000000, 2000000, 3000000]) {
        it(`Test a long rollback with gasLimit ${gasLimit}`, async function() {
            const batchID = await getTipBatchID();
            await rollup.testRollback(1, { gasLimit });
            console.log(
                `Number of batch you can revert with ${gasLimit} gas`,
                batchID - (await getTipBatchID())
            );
        });
    }
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
    it("Test rollback with deposits");
});
