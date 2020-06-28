import * as chai from "chai";
import * as walletHelper from "../scripts/helpers/wallet";
import * as ethUtils from "ethereumjs-util";
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
      web3.utils.toWei("1"),
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
    var coordinator_leaf =
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";

    var maxSize = 4;
    console.log("User information", "Alice", Alice, "bob", Bob);

    var BalanceOfAlice = await testTokenInstance.balanceOf(Alice.Address);

    // Deposit Alice
    await depositManagerInstance.deposit(
      Alice.Amount,
      Alice.TokenType,
      Alice.Pubkey
    );

    var AliceAccountLeaf = utils.CreateAccountLeaf(
      Alice.AccID,
      Alice.Amount,
      0,
      Alice.TokenType
    );

    var BalanceOfAliceAfterDeposit = await testTokenInstance.balanceOf(
      Alice.Address
    );

    assert.equal(
      BalanceOfAliceAfterDeposit,
      BalanceOfAlice - Alice.Amount,
      "User balance did not reduce after deposit"
    );

    // verify pending deposits
    var pendingDeposits0 = await depositManagerInstance.pendingDeposits(0);
    assert.equal(pendingDeposits0, AliceAccountLeaf, "Account hash mismatch");

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

    var BobAccountLeaf = await utils.CreateAccountLeaf(
      Bob.AccID,
      Bob.Amount,
      0,
      Bob.TokenType
    );

    pendingDeposits0 = await depositManagerInstance.dequeue.call();

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
      utils.getParentLeaf(coordinator_leaf, coordinator_leaf),
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

  // it("submit a new batch", async function() {
  //   let depositManagerInstance = await DepositManager.deployed();
  //   var testTokenInstance = await TestToken.deployed();
  //   let rollupCoreInstance = await RollupCore.deployed();
  //   var MTutilsInstance = await utils.getMerkleTreeUtils();
  //   let testToken = await TestToken.deployed();
  //   let RollupUtilsInstance = await RollupUtils.deployed();
  //   let tokenRegistryInstance = await utils.getTokenRegistry();
  //   let IMTInstance = await IMT.deployed();

  //   var OriginalAlice = {
  //     Address: wallets[0].getAddressString(),
  //     Pubkey: wallets[0].getPublicKeyString(),
  //     Amount: 10,
  //     TokenType: 1,
  //     AccID: 2,
  //     Path: "2"
  //   };
  //   var OriginalBob = {
  //     Address: wallets[1].getAddressString(),
  //     Pubkey: wallets[1].getPublicKeyString(),
  //     Amount: 10,
  //     TokenType: 1,
  //     AccID: 3,
  //     Path: "3"
  //   };
  //   var coordinator_leaf =
  //     "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";
  //   var coordinatorPubkeyHash =
  //     "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
  //   var maxSize = 4;
  //   var AliceAccountLeaf = utils.CreateAccountLeaf(
  //     OriginalAlice.AccID,
  //     OriginalAlice.Amount,
  //     0,
  //     OriginalAlice.TokenType
  //   );
  //   var BobAccountLeaf = utils.CreateAccountLeaf(
  //     OriginalBob.AccID,
  //     OriginalBob.Amount,
  //     0,
  //     OriginalBob.TokenType
  //   );

  //   // make a transfer between alice and bob's account
  //   var tranferAmount = 1;
  //   var NewAliceAccountLeaf = utils.CreateAccountLeaf(
  //     OriginalAlice.AccID,
  //     OriginalAlice.Amount - tranferAmount,
  //     1,
  //     OriginalAlice.TokenType
  //   );

  //   var NewBobAccountLeaf = utils.CreateAccountLeaf(
  //     OriginalBob.AccID,
  //     OriginalBob.Amount + tranferAmount,
  //     1,
  //     OriginalBob.TokenType
  //   );

  //   // prepare data for process Tx
  //   var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
  //   var accountRoot = await IMTInstance.getTreeRoot();
  //   var zeroHashes: any = await utils.defaultHashes(maxSize);
  //   var AlicePDAsiblings = [
  //     utils.PubKeyHash(OriginalBob.Pubkey),
  //     utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
  //     zeroHashes[2],
  //     zeroHashes[3]
  //   ];

  //   var BobPDAsiblings = [
  //     utils.PubKeyHash(OriginalAlice.Pubkey),
  //     utils.getParentLeaf(
  //       coordinatorPubkeyHash,
  //       utils.PubKeyHash(OriginalAlice.Pubkey)
  //     ),
  //     zeroHashes[2],
  //     zeroHashes[3]
  //   ];

  //   var alicePDAProof = {
  //     _pda: {
  //       pathToPubkey: "2",
  //       pubkey_leaf: {pubkey: OriginalAlice.Pubkey}
  //     },
  //     siblings: AlicePDAsiblings
  //   };

  //   var isValid = await MTutilsInstance.verifyLeaf(
  //     accountRoot,
  //     utils.PubKeyHash(OriginalAlice.Pubkey),
  //     "2",
  //     AlicePDAsiblings
  //   );
  //   assert.equal(isValid, true, "pda proof wrong");

  //   var bobPDAProof = {
  //     _pda: {
  //       pathToPubkey: "2",
  //       pubkey_leaf: {pubkey: OriginalBob.Pubkey}
  //     },
  //     siblings: BobPDAsiblings
  //   };

  //   var tx = {
  //     fromIndex: OriginalAlice.AccID,
  //     toIndex: OriginalBob.AccID,
  //     tokenType: OriginalAlice.TokenType,
  //     amount: tranferAmount,
  //     signature:
  //       "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563"
  //   };

  //   var dataToSign = await RollupUtilsInstance.getTxHash(
  //     tx.fromIndex,
  //     tx.toIndex,
  //     tx.tokenType,
  //     tx.amount
  //   );

  //   const h = ethUtils.toBuffer(dataToSign);
  //   var signature = ethUtils.ecsign(h, wallets[0].getPrivateKey());
  //   tx.signature = ethUtils.toRpcSig(signature.v, signature.r, signature.s);

  //   // alice balance tree merkle proof
  //   var AliceAccountSiblings: Array<string> = [
  //     BobAccountLeaf,
  //     utils.getParentLeaf(coordinator_leaf, zeroHashes[0]),
  //     zeroHashes[2],
  //     zeroHashes[3]
  //   ];
  //   var leaf = AliceAccountLeaf;
  //   var AliceAccountPath: string = "2";
  //   var isValid = await MTutilsInstance.verifyLeaf(
  //     currentRoot,
  //     leaf,
  //     AliceAccountPath,
  //     AliceAccountSiblings
  //   );
  //   expect(isValid).to.be.deep.eq(true);

  //   var AliceAccountMP = {
  //     accountIP: {
  //       pathToAccount: AliceAccountPath,
  //       account: {
  //         ID: OriginalAlice.AccID,
  //         tokenType: OriginalAlice.TokenType,
  //         balance: OriginalAlice.Amount,
  //         nonce: 0
  //       }
  //     },
  //     siblings: AliceAccountSiblings
  //   };

  //   var UpdatedAliceAccountLeaf = utils.CreateAccountLeaf(
  //     OriginalAlice.AccID,
  //     OriginalAlice.Amount - tx.amount,
  //     0,
  //     OriginalAlice.TokenType
  //   );

  //   // bob balance tree merkle proof
  //   var BobAccountSiblings: Array<string> = [
  //     UpdatedAliceAccountLeaf,
  //     utils.getParentLeaf(coordinator_leaf, zeroHashes[0]),
  //     zeroHashes[2],
  //     zeroHashes[3]
  //   ];
  //   var leaf = BobAccountLeaf;
  //   var BobAccountPath: string = "3";

  //   var isBobValid = await MTutilsInstance.verifyLeaf(
  //     currentRoot,
  //     leaf,
  //     BobAccountPath,
  //     BobAccountSiblings
  //   );

  //   var BobAccountMP = {
  //     accountIP: {
  //       pathToAccount: BobAccountPath,
  //       account: {
  //         ID: OriginalBob.AccID,
  //         tokenType: OriginalBob.TokenType,
  //         balance: OriginalBob.Amount,
  //         nonce: 0
  //       }
  //     },
  //     siblings: BobAccountSiblings
  //   };

  //   // process transaction validity with process tx
  //   var result = await rollupCoreInstance.processTx(
  //     currentRoot,
  //     accountRoot,
  //     tx,
  //     alicePDAProof,
  //     AliceAccountMP,
  //     BobAccountMP
  //   );
  //   console.log("result of processTx", result);

  //   // change the tokenType so that the batch is invalid
  //   var compressedTx = await utils.compressTx(
  //     tx.fromIndex,
  //     tx.toIndex,
  //     tx.amount,
  //     2,
  //     tx.signature
  //   );

  //   let compressedTxs: string[] = [];
  //   compressedTxs.push(compressedTx);

  //   // submit batch for that transactions
  //   await rollupCoreInstance.submitBatch(
  //     compressedTxs,
  //     "0xb6b4b5c6cb43071b3913b1d500b33c52392f7aa85f8a451448e20c3967f2b21a",
  //     {value: ethers.utils.parseEther("32").toString()}
  //   );
  // });
});
