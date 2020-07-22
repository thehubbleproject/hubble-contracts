import * as chai from "chai";
import * as walletHelper from "../../scripts/helpers/wallet";
const TestToken = artifacts.require("TestToken");
const chaiAsPromised = require("chai-as-promised");
const DepositManager = artifacts.require("DepositManager");
const RollupCore = artifacts.require("Rollup");
import * as utils from "../../scripts/helpers/utils";
import { ethers } from "ethers";

chai.use(chaiAsPromised);

contract("DepositManager", async function(accounts) {
    var wallets: any;
    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
    });

    it("should register a token", async function() {
        let testToken = await TestToken.deployed();
        let tokenRegistryInstance = await utils.getTokenRegistry();
        let registerTokenReceipt = await tokenRegistryInstance.requestTokenRegistration(
            testToken.address,
            { from: wallets[0].getAddressString() }
        );
    });

    it("should finalise token registration", async () => {
        let testToken = await TestToken.deployed();

        let tokenRegistryInstance = await utils.getTokenRegistry();

        let approveToken = await tokenRegistryInstance.finaliseTokenRegistration(
            testToken.address,
            { from: wallets[0].getAddressString() }
        );

        assert(approveToken, "token registration failed");
    });

    // ----------------------------------------------------------------------------------
    it("should approve Rollup on TestToken", async () => {
        let testToken = await TestToken.deployed();
        let depositManagerInstance = await DepositManager.deployed();
        let approveToken = await testToken.approve(
            depositManagerInstance.address,
            ethers.utils.parseEther("1"),
            {
                from: wallets[0].getAddressString()
            }
        );
        assert(approveToken, "approveToken failed");
    });

    it("should allow doing one deposit", async () => {
        let depositManagerInstance = await DepositManager.deployed();
        var Alice = {
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 1,
            Path: "2"
        };
        let result = await depositManagerInstance.deposit(
            Alice.Amount,
            Alice.TokenType,
            Alice.Pubkey
        );
    });
});
