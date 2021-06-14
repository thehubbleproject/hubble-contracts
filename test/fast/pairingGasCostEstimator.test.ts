import { ethers } from "hardhat";
import {
    BNPairingPrecompileCostEstimator,
    BNPairingPrecompileCostEstimator__factory
} from "../../types/ethers-contracts";
import { assert } from "chai";
import { expectRevert } from "../../test/utils";

const BigNumber = ethers.BigNumber;

// go-ethereum/params/protocol_params.go
const REF_BASE_COST = BigNumber.from(45000); // Base price for an elliptic curve pairing check
const REF_BASE_COST_WITH_OVERHEAD = REF_BASE_COST.mul(105).div(100);
const REF_PER_PAIR_COST = BigNumber.from(34000); // Per-point price for an elliptic curve pairing check

describe("BnPairingPrecompileCostEstimator", async () => {
    let c: BNPairingPrecompileCostEstimator;
    before(async function() {
        const accounts = await ethers.getSigners();
        c = await new BNPairingPrecompileCostEstimator__factory(
            accounts[0]
        ).deploy();
        await c.deployed();
        const baseCost0 = await c.baseCost();
        const perPairCost0 = await c.perPairCost();
        assert.isTrue(baseCost0.eq(0));
        assert.isTrue(perPairCost0.eq(0));
    });
    it("estimate gas", async function() {
        await c.run();
        const baseCost0 = await c.baseCost();
        const perPairCost0 = await c.perPairCost();
        assert.isTrue(baseCost0.lt(REF_BASE_COST_WITH_OVERHEAD));
        assert.isTrue(baseCost0.gt(REF_BASE_COST));
        assert.isTrue(REF_PER_PAIR_COST.eq(perPairCost0));
        await c.run();
        const baseCost1 = await c.baseCost();
        const perPairCost1 = await c.perPairCost();
        assert.isTrue(baseCost0.eq(baseCost1));
        assert.isTrue(perPairCost0.eq(perPairCost1));
    });
    it("out of gas", async function() {
        await expectRevert(
            c.run({ gasLimit: REF_BASE_COST.add(REF_PER_PAIR_COST) }),
            ""
        );
    });
});
