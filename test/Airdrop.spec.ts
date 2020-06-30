import { ethers } from "ethers";
const RollupCore = artifacts.require("Rollup");

describe("Rollup Airdrop", async function () {

    it("lets coordinator submit a batch", async function () {
        const rollupCoreInstance = await RollupCore.deployed()
        await rollupCoreInstance.submitBatch(
            ["0xabc", "0xabc"],
            "0xb6b4b5c6cb43071b3913b1d500b33c52392f7aa85f8a451448e20c3967f2b21a",
            0,
            { value: ethers.utils.parseEther("32").toString() },
        )

        // create drops 

        // createAirdropBatch(drops, dropTokenType, rollupInstance, coordinator_wallet)

        // rollupCoreInstance.submitBatch
    })

    it("lets anybody dispute a batch", async function () {

    })

})