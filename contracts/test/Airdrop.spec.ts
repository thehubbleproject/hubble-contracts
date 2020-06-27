import { deployEverything } from '../scripts/helpers/depolyer'
import { createAirdropBatch } from '../offchain/airdrop'

describe("Rollup Airdrop", async function () {
    let rollupCoreInstance: any
    before(async function () {
        const deployed = await deployEverything()
        rollupCoreInstance = deployed.rollupCoreInstance
    })

    it("lets coordinator submit a batch", async function () {

        const root = await rollupCoreInstance.getLatestBalanceTreeRoot()
        expect(root.startsWith('0x')).is.true


        // create drops 

        // createAirdropBatch(drops, dropTokenType, rollupInstance, coordinator_wallet)

        // rollupCoreInstance.submitBatch
    })

    it("lets anybody dispute a batch", async function () {

    })

})