import { ethers } from "ethers";
import * as utils from '../scripts/helpers/utils'
const RollupCore = artifacts.require("Rollup");
const burnConsent = artifacts.require("BurnConsent");
const burnExecution = artifacts.require("BurnExecution");

contract("Burn", async function () {

    const rollupCoreInstance = await RollupCore.deployed()
    const burnConsentInstance = await burnConsent.deployed()
    const burnExecutionInstance = await burnExecution.deployed()

    it("lets coordinator submit a batch of burn consent", async function () {
        await rollupCoreInstance.submitBatch(
            ["0xabc", "0xabc"],
            "0xb6b4b5c6cb43071b3913b1d500b33c52392f7aa85f8a451448e20c3967f2b21a",
            utils.BatchType.BurnConsent,
            { value: ethers.utils.parseEther("32").toString() },
        )
    })

    it("lets coordinator submit a batch of burn execution", async function () {
        await rollupCoreInstance.submitBatch(
            ["0xabc", "0xabc"],
            "0xb6b4b5c6cb43071b3913b1d500b33c52392f7aa85f8a451448e20c3967f2b21a",
            utils.BatchType.BurnExecution,
            { value: ethers.utils.parseEther("32").toString() },
        )
    })

    it("lets anybody dispute a batch of burn consent")
    it("lets anybody dispute a batch of burn execution")

})
