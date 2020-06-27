const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
import * as utils from "./utils";


export async function deployEverything() {
    const depositManagerInstance = await DepositManager.deployed();
    const testTokenInstance = await TestToken.deployed();
    const rollupCoreInstance = await RollupCore.deployed();
    const MTutilsInstance = await utils.getMerkleTreeUtils();
    const testToken = await TestToken.deployed();
    const RollupUtilsInstance = await RollupUtils.deployed();
    const tokenRegistryInstance = await utils.getTokenRegistry();
    const IMTInstance = await IMT.deployed();
    return {
        depositManagerInstance,
        testTokenInstance,
        rollupCoreInstance,
        MTutilsInstance,
        testToken,
        RollupUtilsInstance,
        tokenRegistryInstance,
        IMTInstance,
    }
}
