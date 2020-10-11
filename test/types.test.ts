import { ethers } from "@nomiclabs/buidler";
import { assert } from "chai";
import { getAddress } from "ethers/lib/utils";
import { randHex, randomNum } from "../ts/utils";
import { TestTypesFactory } from "../types/ethers-contracts";
import { TestTypes } from "../types/ethers-contracts/TestTypes";

describe("Type testing", function() {
    let contract: TestTypes;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contract = await new TestTypesFactory(signer).deploy();
    });
    it("encode and decode meta fields", async function() {
        const expected = {
            batchType: randomNum(1),
            commitmentLength: randomNum(1),
            committer: getAddress(randHex(20)),
            finaliseOn: randomNum(4)
        };

        const meta = await contract.encodeMeta(
            expected.batchType,
            expected.commitmentLength,
            expected.committer,
            expected.finaliseOn
        );
        const {
            batchType,
            commitmentLength,
            committer,
            finaliseOn
        } = await contract.decodeMeta(meta);
        assert.equal(batchType.toNumber(), expected.batchType);
        assert.equal(commitmentLength.toNumber(), expected.commitmentLength);
        assert.equal(committer, expected.committer);
        assert.equal(finaliseOn.toNumber(), expected.finaliseOn);
    });
});
