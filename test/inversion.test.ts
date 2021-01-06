import { InvFactory } from "../types/ethers-contracts/InvFactory";
import { Inv } from "../types/ethers-contracts/Inv";
import { assert } from "chai";
import { ethers } from "hardhat";

import { randFs, FIELD_ORDER } from "../ts/utils";
import { BigNumber } from "ethers";

const n = 10;

describe("Inversion", async () => {
    let inv: Inv;
    before(async function() {
        const accounts = await ethers.getSigners();
        inv = await new InvFactory(accounts[0]).deploy();
        await inv.deployed();
    });
    it("inv eea", async function() {
        const q = BigNumber.from(FIELD_ORDER);
        for (let i = 0; i < n; i++) {
            const e = randFs();
            const ei = await inv.inverseEEA(e, q);
            BigNumber.from(e);
            BigNumber.from(ei);
            const one = BigNumber.from(1);
            const mustBeOne = e.mul(ei).mod(q);
            assert.isTrue(one.eq(mustBeOne), `iter: ${i}`);
        }
    });
    it("inv eea cost", async function() {
        const q = BigNumber.from(FIELD_ORDER);
        let totalCost = BigNumber.from(0);
        for (let i = 0; i < n; i++) {
            const e = randFs();
            const cost = await inv.callStatic.inverseEEACost(e, q);
            totalCost = totalCost.add(cost);
        }
        const avgCost = totalCost.div(n);
        console.log(`average eea inversion cost: ${avgCost.toString()}`);
    });
    it("inv modexp", async function() {
        const q = BigNumber.from(FIELD_ORDER);
        for (let i = 0; i < n; i++) {
            const e = randFs();
            const ei = await inv.inverseModexp(e);
            BigNumber.from(e);
            BigNumber.from(ei);
            const one = BigNumber.from(1);
            const mustBeOne = e.mul(ei).mod(q);
            assert.isTrue(one.eq(mustBeOne), `iter: ${i}`);
        }
    });
    it("inv modexp cost", async function() {
        let totalCost = BigNumber.from(0);
        for (let i = 0; i < n; i++) {
            const e = randFs();
            const cost = await inv.callStatic.inverseModexpCost(e);
            totalCost = totalCost.add(cost);
        }
        const avgCost = totalCost.div(n);
        console.log(`average modexp inversion cost: ${avgCost.toString()}`);
    });
});
