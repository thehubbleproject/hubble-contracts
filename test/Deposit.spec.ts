import * as chai from "chai";
import * as walletHelper from "./helpers/wallet";
const TestToken = artifacts.require("TestToken");
const chaiAsPromised = require("chai-as-promised");
const DepositManager = artifacts.require("DepositManager");
const Rollup = artifacts.require("Rollup");
const TokenRegistry = artifacts.require("TokenRegistry");
const nameRegistry = artifacts.require("NameRegistry");
const ParamManager = artifacts.require("ParamManager");
const IncrementalTree = artifacts.require("IncrementalTree");
import * as utils from "./helpers/utils";
chai.use(chaiAsPromised);

contract("Rollup", async function(accounts) {
  var wallets: any;
  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  it("should register a token", async function() {
    let testToken = await TestToken.deployed();
    let tokenRegistryInstance = await getTokenRegistry();
    console.log("tokenregistry", tokenRegistryInstance.address);
    let registerTokenReceipt = await tokenRegistryInstance.requestTokenRegistration(
      testToken.address,
      {from: wallets[0].getAddressString()}
    );
    console.log("register token receipt", registerTokenReceipt);
  });

  // ----------------------------------------------------------------------------------

  it("should finalise token registration", async () => {
    let testToken = await TestToken.deployed();

    let tokenRegistryInstance = await getTokenRegistry();
    console.log("tokenregistry", tokenRegistryInstance.address);

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
      web3.utils.toWei("1"),
      {
        from: wallets[0].getAddressString()
      }
    );
    assert(approveToken, "approveToken failed");
  });

  it("should approve allow depositing one test token", async () => {
    console.log("making sure all other contracts are in place");

    // get deployed name registry instance
    var nameRegistryInstance = await nameRegistry.deployed();

    // get deployed parama manager instance
    var paramManager = await ParamManager.deployed();

    // get accounts tree key
    var accountsTreeKey = await paramManager.ACCOUNTS_TREE();

    console.log(
      "accounts tree set",
      await nameRegistryInstance.getContractDetails(accountsTreeKey)
    );

    // var accountsTree = await IncrementalTree.deployed();
    // accountsTree.appendLeaf(
    //   "0xf63d08e5a1ae455242248eb89ad135a2ae3b9a7f72eedc46753da82ba45bee72"
    // );
    let depositManagerInstance = await DepositManager.deployed();
    let result = await depositManagerInstance.deposit(
      10,
      1,
      wallets[0].getPublicKeyString()
    );
    console.log(result);
  });
});

async function getTokenRegistry() {
  // get deployed name registry instance
  var nameRegistryInstance = await nameRegistry.deployed();

  // get deployed parama manager instance
  var paramManager = await ParamManager.deployed();

  // get accounts tree key
  var tokenRegistryKey = await paramManager.TOKEN_REGISTRY();

  var tokenRegistryAddress = await nameRegistryInstance.getContractDetails(
    tokenRegistryKey
  );
  return TokenRegistry.at(tokenRegistryAddress);
}
