import { createAirdropBatch } from '../offchain/airdrop'
const RollupCore = artifacts.require("Rollup");

describe("Rollup Airdrop", async function () {

    it("lets coordinator submit a batch", async function () {
        const rollupCoreInstance = await RollupCore.deployed()

        const root = await rollupCoreInstance.getLatestBalanceTreeRoot()
        expect(root.startsWith('0x')).is.true


        // create drops 

        // createAirdropBatch(drops, dropTokenType, rollupInstance, coordinator_wallet)

        // rollupCoreInstance.submitBatch
    })

    it("lets anybody dispute a batch", async function () {

    })

})