import { assert } from "chai";
import { ethers } from "hardhat";
import { TESTING_PARAMS as parameters } from "../../ts/constants";
import { generateDomainSeparatorFromRollup } from "../../ts/domain";
import { StateTree } from "../../ts/stateTree";
import { randomAddress } from "../../ts/utils";
import {
    DepositManager__factory,
    Rollup,
    Rollup__factory
} from "../../types/ethers-contracts";

describe("Rollup", () => {
    let rollup: Rollup;

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();

        const fakeAddress = randomAddress();
        const depositManager = await new DepositManager__factory(signer).deploy(
            fakeAddress,
            fakeAddress,
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        const stateTree = new StateTree(parameters.MAX_DEPTH);
        rollup = await new Rollup__factory(signer).deploy(
            fakeAddress,
            depositManager.address,
            fakeAddress,
            fakeAddress,
            fakeAddress,
            fakeAddress,
            stateTree.root,
            0,
            0,
            0,
            0
        );
    });

    describe("domainSeparator", () => {
        it("matches EIP-712 spec and has correct values", async function() {
            const [
                expectedDomainSeparator,
                domainSeparator
            ] = await Promise.all([
                generateDomainSeparatorFromRollup(rollup),
                rollup.domainSeparator()
            ]);
            assert.equal(domainSeparator, expectedDomainSeparator);
        });
    });
});
