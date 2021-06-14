import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { randomAddress } from "../../ts/utils";
import { Vault, Vault__factory } from "../../types/ethers-contracts";

chai.use(chaiAsPromised);

describe("Vault", () => {
    let owner: SignerWithAddress;
    let otherSigner: SignerWithAddress;
    let vault: Vault;

    beforeEach(async function() {
        const signers = await ethers.getSigners();
        owner = signers[0];
        otherSigner = signers[1];

        const fakeAddress = randomAddress();
        vault = await new Vault__factory(owner).deploy(
            fakeAddress,
            fakeAddress
        );
    });

    describe("setRollupAddress", () => {
        it("fails if sender is not owner", async function() {
            await assert.isRejected(
                vault.connect(otherSigner).setRollupAddress(randomAddress()),
                /.*Ownable: caller is not the owner/
            );
        });

        it("sets rollup contract address and fails if called again", async function() {
            const rollupAddress = randomAddress();
            await vault.setRollupAddress(rollupAddress);
            assert.equal(await vault.rollup(), rollupAddress);
            await assert.isRejected(
                vault.setRollupAddress(randomAddress()),
                /.*Initializable: contract is already initialized/
            );
        });
    });
});
