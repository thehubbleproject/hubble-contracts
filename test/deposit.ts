import * as chai from "chai";
const walletHelper = require("./helpers/wallet.js");
const TestToken = artifacts.require("TestToken");
const chaiAsPromised = require("chai-as-promised");
const Rollup = artifacts.require("Rollup");
const TokenRegistry = artifacts.require("TokenRegistry");

chai.use(chaiAsPromised);

contract("Rollup", async function(accounts) {
  let wallets;

  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  it("set Rollup in token registry", async function() {
    let tokenRegistry = await TokenRegistry.deployed();
    let rollupInstance = await Rollup.deployed();
    let setRollup = await tokenRegistry.setRollupAddress(
      rollupInstance.address,
      {from: wallets[0].getAddressString()}
    );
    assert(setRollup, "setRollupNC failed");
  });

  it("should register a token", async function() {
    let testToken = await TestToken.deployed();
    let rollupInstance = await Rollup.deployed();
    let registerTokenReceipt = await rollupInstance.requestTokenRegistration(
      testToken.address,
      {from: wallets[0].getAddressString()}
    );
  });

  // ----------------------------------------------------------------------------------

  it("should finalise token registration", async () => {
    let testToken = await TestToken.deployed();
    let rollupInstance = await Rollup.deployed();
    let approveToken = await rollupInstance.finaliseTokenRegistration(
      testToken.address,
      {from: wallets[0].getAddressString()}
    );

    assert(approveToken, "token registration failed");
  });

  // ----------------------------------------------------------------------------------
  it("should approve Rollup on TestToken", async () => {
    let rollupInstance = await Rollup.deployed();
    let testToken = await TestToken.deployed();
    let approveToken = await testToken.approve(rollupInstance.address, 1700, {
      from: wallets[0].getAddressString()
    });
    assert(approveToken, "approveToken failed");
  });

  it("should approve allow depositing one test token", async () => {
    let rollupInstance = await Rollup.deployed();
    let result = await rollupInstance.deposit(
      10,
      0,
      wallets[0].getPublicKeyString()
    );
    console.log(result);
  });
});
