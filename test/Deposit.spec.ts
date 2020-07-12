import * as chai from "chai";
import * as walletHelper from "../scripts/helpers/wallet";
import { Account } from "../scripts/helpers/interfaces";
const TestToken = artifacts.require("TestToken");
const chaiAsPromised = require("chai-as-promised");
const DepositManager = artifacts.require("DepositManager");
import * as utils from "../scripts/helpers/utils";
import { RollupContract } from "../types/truffle-contracts/index";
const abiDecoder = require("abi-decoder"); // NodeJS

import { ethers } from "ethers";
const RollupCore = artifacts.require("Rollup");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const EcVerify = artifacts.require("ECVerify");
chai.use(chaiAsPromised);
const truffleAssert = require("truffle-assertions");

contract("DepositManager", async function (accounts) {
  var wallets: any;
  before(async function () {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  it("should register a token", async function () {
    let testToken = await TestToken.deployed();
    let tokenRegistryInstance = await utils.getTokenRegistry();
    await tokenRegistryInstance.requestTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString(),
    });
  });

  // ----------------------------------------------------------------------------------

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
        from: wallets[0].getAddressString(),
      }
    );
    assert(approveToken, "approveToken failed");
  });

  it("should allow depositing 2 leaves in a subtree and merging it", async () => {
    let depositManagerInstance = await DepositManager.deployed();
    var rollupContractInstance = await RollupCore.deployed();
    var testTokenInstance = await TestToken.deployed();
    let rollupCoreInstance = await RollupCore.deployed();
    var rollupUtilsInstance = await RollupUtils.deployed();
    var MTutilsInstance = await utils.getMerkleTreeUtils();

    var Alice = {
      Address: wallets[0].getAddressString(),
      Pubkey: wallets[0].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 2,
      Path: "2",
    };
    var Bob = {
      Address: wallets[1].getAddressString(),
      Pubkey: wallets[1].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 3,
      Path: "3",
    };
    var coordinator_leaves = await rollupUtilsInstance.GetGenesisLeaves();

    var maxSize = 4;
    console.log("User information", "Alice", Alice, "bob", Bob);

    var BalanceOfAlice = await testTokenInstance.balanceOf(Alice.Address);

    // Deposit Alice
    await depositManagerInstance.deposit(
      Alice.Amount,
      Alice.TokenType,
      Alice.Pubkey
    );
    const AliceAccount: Account = {
      ID: Alice.AccID,
      tokenType: Alice.TokenType,
      balance: Alice.Amount,
      nonce: 0
    }
    var AliceAccountLeaf = await utils.CreateAccountLeaf(AliceAccount);

    var BalanceOfAliceAfterDeposit = await testTokenInstance.balanceOf(
      Alice.Address
    );

    assert.equal(
      BalanceOfAliceAfterDeposit,
      BalanceOfAlice - Alice.Amount,
      "User balance did not reduce after deposit"
    );

    //
    // do second deposit
    //

    // do a deposit for bob
    await depositManagerInstance.depositFor(
      Bob.Address,
      Bob.Amount,
      Bob.TokenType,
      Bob.Pubkey
    );

    const BobAccount: Account = {
      ID:Bob.AccID,
      tokenType:Bob.TokenType,
      balance: Bob.Amount,
      nonce: 0
    }
    var BobAccountLeaf = await utils.CreateAccountLeaf(BobAccount);

    var pendingDeposits0 = await depositManagerInstance.dequeue.call();

    assert.equal(
      pendingDeposits0,
      utils.getParentLeaf(AliceAccountLeaf, BobAccountLeaf),
      "Account hash mismatch 2"
    );

    var pendingDepositAfter = await depositManagerInstance.queueNumber();
    assert.equal(pendingDepositAfter, 0, "pending deposits mismatch");

    // do a deposit for bob
    await depositManagerInstance.depositFor(
      Bob.Address,
      Bob.Amount,
      Bob.TokenType,
      Bob.Pubkey
    );

    // do a deposit for bob
    await depositManagerInstance.depositFor(
      Bob.Address,
      Bob.Amount,
      Bob.TokenType,
      Bob.Pubkey
    );

    // finalise the deposit back to the state tree
    var path = "001";

    var subtreeDepth = 1;
    var defaultHashes = await utils.defaultHashes(4);

    var siblingsInProof = [
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      defaultHashes[2],
      defaultHashes[3],
    ];

    var _zero_account_mp = {
      accountIP: {
        pathToAccount: path,
        account: {
          ID: 0,
          tokenType: 0,
          balance: 0,
          nonce: 0,
        },
      },
      siblings: siblingsInProof,
    };

    await rollupContractInstance.finaliseDepositsAndSubmitBatch(
      subtreeDepth,
      _zero_account_mp,
      { value: ethers.utils.parseEther("32").toString() }
    );

    //
    // verify accounts exist in the new balance root
    //
    var newBalanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();

    // verify sub tree has been inserted first at path 0
    var isSubTreeInserted = await MTutilsInstance.verifyLeaf(
      newBalanceRoot,
      utils.getParentLeaf(AliceAccountLeaf, BobAccountLeaf),
      "001",
      siblingsInProof
    );
    expect(isSubTreeInserted).to.be.deep.eq(true);

    // verify first account at path 0001
    var account1siblings: Array<string> = [
      BobAccountLeaf,
      siblingsInProof[0],
      siblingsInProof[1],
      siblingsInProof[2],
    ];
    var leaf = AliceAccountLeaf;
    var firstAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      newBalanceRoot,
      leaf,
      firstAccountPath,
      account1siblings
    );
    expect(isValid).to.be.deep.eq(true);

    // verify second account at path 11
    var account2siblings: Array<string> = [
      AliceAccountLeaf,
      siblingsInProof[0],
      siblingsInProof[1],
      siblingsInProof[2],
    ];
    var leaf = BobAccountLeaf;
    var secondAccountPath: string = "3";
    var isValid = await MTutilsInstance.verifyLeaf(
      newBalanceRoot,
      leaf,
      secondAccountPath,
      account2siblings
    );
    expect(isValid).to.be.deep.eq(true);
  });
});
