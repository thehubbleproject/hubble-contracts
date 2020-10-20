"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buidler_1 = require("@nomiclabs/buidler");
const chai_1 = require("chai");
const utils_1 = require("ethers/lib/utils");
const utils_2 = require("../ts/utils");
const ethers_contracts_1 = require("../types/ethers-contracts");
describe("Type testing", function () {
    let contract;
    before(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        contract = await new ethers_contracts_1.TestTypesFactory(signer).deploy();
    });
    it("encode and decode meta fields", async function () {
        const expected = {
            batchType: utils_2.randomNum(1),
            commitmentLength: utils_2.randomNum(1),
            committer: utils_1.getAddress(utils_2.randHex(20)),
            finaliseOn: utils_2.randomNum(4)
        };
        const meta = await contract.encodeMeta(expected.batchType, expected.commitmentLength, expected.committer, expected.finaliseOn);
        const { batchType, commitmentLength, committer, finaliseOn } = await contract.decodeMeta(meta);
        chai_1.assert.equal(batchType.toNumber(), expected.batchType);
        chai_1.assert.equal(commitmentLength.toNumber(), expected.commitmentLength);
        chai_1.assert.equal(committer, expected.committer);
        chai_1.assert.equal(finaliseOn.toNumber(), expected.finaliseOn);
    });
});
//# sourceMappingURL=types.test.js.map