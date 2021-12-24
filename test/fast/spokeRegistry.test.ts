import {
    SpokeRegistry,
    SpokeRegistry__factory
} from "../../types/ethers-contracts";
import { ethers } from "hardhat";
import { assert } from "chai";
import { randomAddress } from "../../ts/utils";
import { zeroAddress } from "ethereumjs-util";

describe("spokeRegistry", async () => {
    let spokeRegistry: SpokeRegistry;

    beforeEach(async () => {
        const [signer] = await ethers.getSigners();
        spokeRegistry = await new SpokeRegistry__factory(signer).deploy();
    });
    it("Spoke registration", async function() {
        const expectedSpokeID = 1;
        const fakeAddress = randomAddress();

        const tx = await spokeRegistry.registerSpoke(fakeAddress);
        const [event] = await spokeRegistry.queryFilter(
            spokeRegistry.filters.SpokeRegistered(null, null),
            tx.blockHash
        );

        assert.equal(event.args?.spokeID.toNumber(), expectedSpokeID);
        assert.equal(event.args?.spokeContract, fakeAddress);

        const gotSpokeAddress = await spokeRegistry.getSpokeAddress(
            expectedSpokeID
        );
        assert.equal(gotSpokeAddress, fakeAddress);
    });
    it("Spoke does not exist", async function() {
        const spokeID = 10;
        const gotSpokeAddress = await spokeRegistry.getSpokeAddress(spokeID);
        assert.equal(gotSpokeAddress, zeroAddress());
    });
});
