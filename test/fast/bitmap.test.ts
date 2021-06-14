import { ethers } from "hardhat";
import { assert } from "chai";
import { TestBitmap, TestBitmap__factory } from "../../types/ethers-contracts";

describe("Bitmap", async () => {
    let contract: TestBitmap;
    before(async function() {
        const [singer] = await ethers.getSigners();
        contract = await new TestBitmap__factory(singer).deploy();
    });

    it("claims", async function() {
        const indices = [0, 123, 255, 256, 257, 10000000];
        for (const index of indices) {
            assert.isFalse(await contract.testIsClaimed(index));
            await contract.testSetClaimed(index);
            assert.isTrue(await contract.testIsClaimed(index));
        }
    });
});
