import * as chai from "chai";
import * as walletHelper from "./helpers/wallet";
const TestToken = artifacts.require("TestToken");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const chaiAsPromised = require("chai-as-promised");
const DepositManager = artifacts.require("DepositManager");
const Rollup = artifacts.require("Rollup");
const TokenRegistry = artifacts.require("TokenRegistry");
const nameRegistry = artifacts.require("NameRegistry");
const ParamManager = artifacts.require("ParamManager");
const IncrementalTree = artifacts.require("IncrementalTree");
const Logger = artifacts.require("Logger");
const Tree = artifacts.require("Tree");
import * as utils from "./helpers/utils";
const abiDecoder = require("abi-decoder"); // NodeJS

chai.use(chaiAsPromised);
const truffleAssert = require("truffle-assertions");

contract("DepositManager", async function(accounts) {
  var wallets: any;
  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  it("should register a token", async function() {
    let testToken = await TestToken.deployed();
    let tokenRegistryInstance = await getTokenRegistry();
    let registerTokenReceipt = await tokenRegistryInstance.requestTokenRegistration(
      testToken.address,
      {from: wallets[0].getAddressString()}
    );
  });

  // ----------------------------------------------------------------------------------

  it("should finalise token registration", async () => {
    let testToken = await TestToken.deployed();

    let tokenRegistryInstance = await getTokenRegistry();

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
    let depositManagerInstance = await DepositManager.deployed();
    var testTokenInstance = await TestToken.deployed();
    await testTokenInstance.transfer(wallets[1].getAddressString(), 100);
    var balBefore = await testTokenInstance.balanceOf(
      wallets[0].getAddressString()
    );
    console.log("balance of user before deposit", balBefore.toString());
    var pendingDepositsBefore = await depositManagerInstance.queueNumber();
    console.log("Pending deposits in queue before", pendingDepositsBefore);
    var depositAmount = 10;
    let tokenID = 1;
    let result = await depositManagerInstance.deposit(
      depositAmount,
      tokenID,
      wallets[0].getPublicKeyString()
    );
    var balAfter = await testTokenInstance.balanceOf(
      wallets[0].getAddressString()
    );
    console.log("balance of user after deposit", balAfter.toString());
    assert.equal(
      balAfter,
      balBefore - depositAmount,
      "User balance did not reduce after deposit"
    );
    var pendingDepositAfter = await depositManagerInstance.queueNumber();
    console.log("Pending deposits in queue after", pendingDepositAfter);
    assert.equal(pendingDepositAfter, 1, "pending deposits mismatch");
    // verify pending deposits
    var pendingDeposits0 = await depositManagerInstance.pendingDeposits(0);
    assert.equal(
      pendingDeposits0,
      utils.CreateAccountLeaf(0, 10, 0, 1),
      "Account hash mismatch"
    );

    //
    // do second deposit
    //

    balBefore = await testTokenInstance.balanceOf(
      wallets[1].getAddressString()
    );

    result = await depositManagerInstance.depositFor(
      wallets[1].getAddressString(),
      depositAmount,
      tokenID,
      wallets[1].getPublicKeyString()
    );

    var pendingDepositAfter = await depositManagerInstance.queueNumber();
    console.log("Pending deposits in queue after", pendingDepositAfter);
    assert.equal(pendingDepositAfter, 2, "pending deposits mismatch");

    console.log(
      "deposit subtree height",
      await depositManagerInstance.depositSubtreeHeight()
    );

    // finalise the deposit back to the state tree
    var MTutilsInstance = await getMerkleTreeUtils();
    console.log("root at depth", await MTutilsInstance.getRoot(3));

    var subtreeDepth = 1;
    var path = 0;

    var defaultHashes = await utils.defaultHashes(2);

    var siblingsInProof = [defaultHashes[1]];

    var _zero_account_mp = {
      accountIP: {
        pathToAccount: path,
        account: {
          ID: 0,
          tokenType: 0,
          balance: 0,
          nonce: 0
        }
      },
      siblings: siblingsInProof
    };
    var txResponse = await depositManagerInstance.finaliseDeposits(
      subtreeDepth,
      _zero_account_mp
    );

    //
    // verify accounts exist in the new balance root
    //

    var balancesTreeInstance = await Tree.deployed();
    var newBalanceRoot = await balancesTreeInstance.getRoot();
    console.log("new balance root from contract", newBalanceRoot);

    var deposit1Leaf = utils.CreateAccountLeaf(0, 10, 0, 1);
    var deposit2Leaf = utils.CreateAccountLeaf(1, 10, 0, 1);
    console.log(
      "new balance root should be",
      utils.getParentLeaf(
        utils.getParentLeaf(deposit1Leaf, deposit2Leaf),
        defaultHashes[1]
      )
    );

    // verify first account at path 00
    var account1siblings: Array<string> = [deposit2Leaf, defaultHashes[1]];
    var leaf = deposit1Leaf;
    var firstAccountPath: string = "00";
    var isValid = await MTutilsInstance.verifyLeaf(
      newBalanceRoot,
      leaf,
      firstAccountPath,
      account1siblings
    );
    expect(isValid).to.be.deep.eq(true);

    // verify second account at path 11
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

async function getMerkleTreeUtils() {
  // get deployed name registry instance
  var nameRegistryInstance = await nameRegistry.deployed();

  // get deployed parama manager instance
  var paramManager = await ParamManager.deployed();

  // get accounts tree key
  var merkleTreeUtilKey = await paramManager.MERKLE_UTILS();

  var merkleTreeUtilsAddr = await nameRegistryInstance.getContractDetails(
    merkleTreeUtilKey
  );
  return MerkleTreeUtils.at(merkleTreeUtilsAddr);
}
