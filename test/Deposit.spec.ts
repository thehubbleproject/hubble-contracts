import * as chai from "chai";
import * as walletHelper from "./helpers/wallet";
const TestToken = artifacts.require("TestToken");
const chaiAsPromised = require("chai-as-promised");
const DepositManager = artifacts.require("DepositManager");
const Rollup = artifacts.require("Rollup");
const TokenRegistry = artifacts.require("TokenRegistry");
chai.use(chaiAsPromised);

contract("Rollup", async function(accounts) {
  var wallets: any;
  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  it("should register a token", async function() {
    let testToken = await TestToken.deployed();
    let tokenRegistryInstance = await TokenRegistry.deployed();
    let registerTokenReceipt = await tokenRegistryInstance.requestTokenRegistration(
      testToken.address,
      {from: wallets[0].getAddressString()}
    );
  });

  // ----------------------------------------------------------------------------------

  it("should finalise token registration", async () => {
    let testToken = await TestToken.deployed();

    let tokenRegistryInstance = await TokenRegistry.deployed();
    let approveToken = await tokenRegistryInstance.finaliseTokenRegistration(
      testToken.address,
      {from: wallets[0].getAddressString()}
    );

    assert(approveToken, "token registration failed");
  });

  // ----------------------------------------------------------------------------------
  it("should approve Rollup on TestToken", async () => {
    let testToken = await TestToken.deployed();
    let depositManagerInstance = await DepositManager.deployed();
    let approveToken = await testToken.approve(
      depositManagerInstance.address,
      1700,
      {
        from: wallets[0].getAddressString()
      }
    );
    assert(approveToken, "approveToken failed");
  });

  // it("should approve allow depositing one test token", async () => {
  //   let rollupInstance = await Rollup.deployed();
  //   let result = await rollupInstance.deposit(
  //     10,
  //     0,
  //     wallets[0].getPublicKeyString()
  //   );
  //   console.log(result);
  // });
});
