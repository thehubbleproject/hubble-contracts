import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { TESTING_PARAMS as params } from "../../ts/constants";
import { randomAddress } from "../../ts/utils";
import {
    DepositManager,
    DepositManager__factory
} from "../../types/ethers-contracts";

chai.use(chaiAsPromised);

describe("DepositManager", () => {
    let owner: SignerWithAddress;
    let otherSigner: SignerWithAddress;
    let depositManager: DepositManager;

    beforeEach(async function() {
        const signers = await ethers.getSigners();
        owner = signers[0];
        otherSigner = signers[1];

        const fakeAddress = randomAddress();
        depositManager = await new DepositManager__factory(owner).deploy(
            fakeAddress,
            fakeAddress,
            params.MAX_DEPOSIT_SUBTREE_DEPTH
        );
    });

    describe("setRollupAddress", () => {
        it("fails if sender is not owner", async function() {
            await assert.isRejected(
                depositManager
                    .connect(otherSigner)
                    .setRollupAddress(randomAddress()),
                /.*Ownable: caller is not the owner/
            );
        });

        it("sets rollup contract address and fails if called again", async function() {
            const rollupAddress = randomAddress();
            await depositManager.setRollupAddress(rollupAddress);
            assert.equal(await depositManager.rollup(), rollupAddress);
            await assert.isRejected(
                depositManager.setRollupAddress(randomAddress()),
                /.*Initializable: contract is already initialized/
            );
        });
    });
});
