import { ethers } from "@nomiclabs/buidler";
import { allContracts } from "../ts/allContractsInterfaces";
import { TESTING_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";

describe("DepositManager", async function() {
    let contracts: allContracts;
    let tokenType: number;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contracts = await deployAll(signer, TESTING_PARAMS);
        const { testToken, tokenRegistry } = contracts;
        await tokenRegistry.requestTokenRegistration(testToken.address);
        await tokenRegistry.finaliseTokenRegistration(testToken.address);
        tokenType = (await tokenRegistry.numTokens()).toNumber();
    });
    it("should allow depositing 2 leaves in a subtree and merging it", async () => {
        const { depositManager, testToken } = contracts;

        await testToken.approve(depositManager.address, 100);

        for (let i = 0; i < 10; i++) {
            console.log("Deposit", i);
            await depositManager.depositFor(i, 10, tokenType);
        }
    });
});
