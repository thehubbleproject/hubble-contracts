"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buidler_1 = require("@nomiclabs/buidler");
const chai_1 = require("chai");
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
const constants_1 = require("../ts/constants");
const deploy_1 = require("../ts/deploy");
const state_1 = require("../ts/state");
const tree_1 = require("../ts/tree");
const utils_2 = require("../ts/utils");
const TestDepositCoreFactory_1 = require("../types/ethers-contracts/TestDepositCoreFactory");
describe("Deposit Core", async function () {
    let contract;
    const maxSubtreeDepth = 4;
    before(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        contract = await new TestDepositCoreFactory_1.TestDepositCoreFactory(signer).deploy(maxSubtreeDepth);
    });
    it("insert and merge many deposits", async function () {
        const maxSubtreeSize = 2 ** maxSubtreeDepth;
        const leaves = utils_2.randomLeaves(maxSubtreeSize);
        const tree = tree_1.Tree.new(maxSubtreeDepth);
        for (let i = 0; i < maxSubtreeSize; i++) {
            const { gasCost, readySubtree } = await contract.callStatic.testInsertAndMerge(leaves[i]);
            console.log(`Insert leaf ${i} \t Operation cost: ${gasCost.toNumber()}`);
            await contract.testInsertAndMerge(leaves[i]);
            tree.updateSingle(i, leaves[i]);
            if (i !== maxSubtreeSize - 1) {
                chai_1.assert.equal(readySubtree, ethers_1.constants.HashZero, "Not a ready subtree yet");
            }
            else {
                chai_1.assert.equal(readySubtree, tree.root, "Should be the merkle root of all leaves");
            }
        }
        chai_1.assert.equal((await contract.back()).toNumber(), 1);
        chai_1.assert.equal(await contract.getQueue(1), tree.root, "subtree root should be in the subtree queue now");
    });
});
const LARGE_AMOUNT_OF_TOKEN = 1000000;
describe("DepositManager", async function () {
    let contracts;
    let tokenType;
    beforeEach(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        contracts = await deploy_1.deployAll(signer, constants_1.TESTING_PARAMS);
        const { testToken, tokenRegistry, depositManager } = contracts;
        tokenType = (await tokenRegistry.numTokens()).toNumber();
        await testToken.approve(depositManager.address, LARGE_AMOUNT_OF_TOKEN);
    });
    it("should allow depositing 2 leaves in a subtree and merging it", async function () {
        const { depositManager, logger } = contracts;
        const deposit0 = state_1.State.new(0, tokenType, 10, 0);
        const deposit1 = state_1.State.new(1, tokenType, 10, 0);
        const pendingDeposit = utils_1.solidityKeccak256(["bytes", "bytes"], [deposit0.toStateLeaf(), deposit1.toStateLeaf()]);
        const gasCost0 = await depositManager.estimateGas.depositFor(0, 10, tokenType);
        console.log("Deposit 0 transaction cost", gasCost0.toNumber());
        await chai_1.expect(depositManager.depositFor(0, 10, tokenType))
            .to.emit(logger, "DepositQueued")
            .withArgs(0, deposit0.encode());
        const gasCost1 = await depositManager.estimateGas.depositFor(1, 10, tokenType);
        console.log("Deposit 1 transaction cost", gasCost1.toNumber());
        await chai_1.expect(depositManager.depositFor(1, 10, tokenType))
            .to.emit(logger, "DepositQueued")
            .withArgs(1, deposit1.encode())
            .and.to.emit(logger, "DepositSubTreeReady")
            .withArgs(pendingDeposit);
    });
});
//# sourceMappingURL=deposit.test.js.map