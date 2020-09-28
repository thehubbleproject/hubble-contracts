import { ethers } from "@nomiclabs/buidler";
import { expect } from "chai";
import { solidityKeccak256 } from "ethers/lib/utils";
import { allContracts } from "../ts/allContractsInterfaces";
import { TESTING_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";
import { State } from "../ts/state";

const LARGE_AMOUNT_OF_TOKEN = 1000000;

describe("DepositManager", async function() {
    let contracts: allContracts;
    let tokenType: number;
    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        contracts = await deployAll(signer, TESTING_PARAMS);
        const { testToken, tokenRegistry, depositManager } = contracts;
        await tokenRegistry.requestTokenRegistration(testToken.address);
        await tokenRegistry.finaliseTokenRegistration(testToken.address);
        tokenType = (await tokenRegistry.numTokens()).toNumber();
        await testToken.approve(depositManager.address, LARGE_AMOUNT_OF_TOKEN);
    });
    it("should allow depositing 2 leaves in a subtree and merging it", async function() {
        const { depositManager, logger } = contracts;
        const deposit0 = State.new(0, tokenType, 10, 0);
        const deposit1 = State.new(1, tokenType, 10, 0);
        const pendingDeposit = solidityKeccak256(
            ["bytes", "bytes"],
            [deposit0.toStateLeaf(), deposit1.toStateLeaf()]
        );

        const gasCost0 = await depositManager.estimateGas.depositFor(
            0,
            10,
            tokenType
        );
        console.log("Deposit 0 transaction cost", gasCost0.toNumber());

        await expect(depositManager.depositFor(0, 10, tokenType))
            .to.emit(logger, "DepositQueued")
            .withArgs(0, deposit0.encode());

        const gasCost1 = await depositManager.estimateGas.depositFor(
            1,
            10,
            tokenType
        );
        console.log("Deposit 1 transaction cost", gasCost1.toNumber());

        await expect(depositManager.depositFor(1, 10, tokenType))
            .to.emit(logger, "DepositQueued")
            .withArgs(1, deposit1.encode())
            .and.to.emit(logger, "DepositLeafMerged")
            .withArgs(
                deposit0.toStateLeaf(),
                deposit1.toStateLeaf(),
                pendingDeposit
            )
            .and.to.emit(logger, "DepositSubTreeReady")
            .withArgs(pendingDeposit);
    });
});
