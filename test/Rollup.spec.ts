import * as utils from "../scripts/helpers/utils";
import {ethers} from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");

contract("Rollup", async function(accounts) {
  var wallets: any;

  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  // test if we are able to create append a leaf
  it("make a deposit of 2 accounts", async function() {
    let depositManagerInstance = await DepositManager.deployed();
    var testTokenInstance = await TestToken.deployed();
    let rollupCoreInstance = await RollupCore.deployed();
    var MTutilsInstance = await utils.getMerkleTreeUtils();
    let testToken = await TestToken.deployed();
    let RollupUtilsInstance = await RollupUtils.deployed();
    let tokenRegistryInstance = await utils.getTokenRegistry();
    let IMTInstance = await IMT.deployed();
    await tokenRegistryInstance.requestTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString()
    });
    await tokenRegistryInstance.finaliseTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString()
    });
    await testToken.approve(
      depositManagerInstance.address,
      web3.utils.toWei("1"),
      {
        from: wallets[0].getAddressString()
      }
    );

    var Alice = {
      Address: wallets[0].getAddressString(),
      Pubkey: wallets[0].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 1,
      Path: "2"
    };
    var Bob = {
      Address: wallets[1].getAddressString(),
      Pubkey: wallets[1].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 2,
      Path: "3"
    };
    var coordinator =
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";
    var maxSize = 4;

    await testTokenInstance.transfer(Alice.Address, 100);
    var AliceAccountLeaf = utils.CreateAccountLeaf(
      Alice.AccID,
      Alice.Amount,
      0,
      Alice.TokenType
    );
    await depositManagerInstance.deposit(
      Alice.Amount,
      Alice.TokenType,
      Alice.Pubkey
    );
    var BobAccountLeaf = utils.CreateAccountLeaf(
      Bob.AccID,
      Bob.Amount,
      0,
      Bob.TokenType
    );
    await depositManagerInstance.depositFor(
      Bob.Address,
      Bob.Amount,
      Bob.TokenType,
      Bob.Pubkey
    );

    var subtreeDepth = 1;

    // finalise the deposit back to the state tree
    var path = "001";
    var defaultHashes = await utils.defaultHashes(4);
    var siblingsInProof = [
      utils.getParentLeaf(coordinator, defaultHashes[0]),
      defaultHashes[2],
      defaultHashes[3]
    ];

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

    var newRoot = await utils.genMerkleRootFromSiblings(
      siblingsInProof,
      path,
      utils.getParentLeaf(AliceAccountLeaf, BobAccountLeaf)
    );

    // TODO make this 0
    var txs: string[] = [
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d"
    ];

    await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
      subtreeDepth,
      _zero_account_mp,
      txs,
      newRoot
    );
    console.log("await");
  });

  it("submit new batch", async function() {
    let depositManagerInstance = await DepositManager.deployed();
    var testTokenInstance = await TestToken.deployed();
    let rollupCoreInstance = await RollupCore.deployed();
    var MTutilsInstance = await utils.getMerkleTreeUtils();
    let testToken = await TestToken.deployed();
    let RollupUtilsInstance = await RollupUtils.deployed();
    let tokenRegistryInstance = await utils.getTokenRegistry();
    let IMTInstance = await IMT.deployed();
    var OriginalAlice = {
      Address: wallets[0].getAddressString(),
      Pubkey: wallets[0].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 1,
      Path: "2"
    };
    var OriginalBob = {
      Address: wallets[1].getAddressString(),
      Pubkey: wallets[1].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 2,
      Path: "3"
    };
    var coordinator =
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";
    var coordinatorPubkeyHash =
      "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    var maxSize = 4;
    var AliceAccountLeaf = utils.CreateAccountLeaf(
      OriginalAlice.AccID,
      OriginalAlice.Amount,
      0,
      OriginalAlice.TokenType
    );
    var BobAccountLeaf = utils.CreateAccountLeaf(
      OriginalBob.AccID,
      OriginalBob.Amount,
      0,
      OriginalBob.TokenType
    );

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    var NewAliceAccountLeaf = utils.CreateAccountLeaf(
      OriginalAlice.AccID,
      OriginalAlice.Amount - tranferAmount,
      1,
      OriginalAlice.TokenType
    );

    var NewBobAccountLeaf = utils.CreateAccountLeaf(
      OriginalBob.AccID,
      OriginalBob.Amount + tranferAmount,
      1,
      OriginalBob.TokenType
    );

    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();
    var zeroHashes: any = await utils.defaultHashes(maxSize);
    // TODO we prob need to hash the pubkeys below

    var AlicePDAsiblings = [
      coordinatorPubkeyHash,
      utils.getParentLeaf(utils.PubKeyHash(OriginalBob.Pubkey), zeroHashes[0]),
      zeroHashes[2],
      zeroHashes[3]
    ];

    var BobPDAsiblings = [
      zeroHashes[0],
      utils.getParentLeaf(
        coordinatorPubkeyHash,
        utils.PubKeyHash(OriginalAlice.Pubkey)
      ),
      zeroHashes[2],
      zeroHashes[3]
    ];
    var alicePDAProof = {
      _pda: {
        pathToPubkey: "1",
        pubkey_leaf: {pubkey: OriginalAlice.Pubkey}
      },
      siblings: AlicePDAsiblings
    };
    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(OriginalAlice.Pubkey),
      "1",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var bobPDAProof = {
      _pda: {
        pathToPubkey: "2",
        pubkey_leaf: {pubkey: OriginalBob.Pubkey}
      },
      siblings: BobPDAsiblings
    };

    var tx = {
      fromIndex: OriginalAlice.AccID,
      toIndex: OriginalBob.AccID,
      tokenType: OriginalAlice.TokenType,
      amount: tranferAmount,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563"
    };
    var dataToSign = await RollupUtilsInstance.getTxHash(
      tx.fromIndex,
      tx.toIndex,
      tx.tokenType,
      tx.amount
    );
    // TODO sign transaction and update the tx with signature
    let aliceWallet = new ethers.Wallet(wallets[0].getPrivateKey());
    var flatSignature = await aliceWallet.signMessage(dataToSign);

    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator, zeroHashes[0]),
      zeroHashes[2],
      zeroHashes[3]
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);

    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: OriginalAlice.AccID,
          tokenType: OriginalAlice.TokenType,
          balance: OriginalAlice.Amount,
          nonce: 0
        }
      },
      siblings: AliceAccountSiblings
    };

    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      AliceAccountLeaf,
      utils.getParentLeaf(coordinator, zeroHashes[0]),
      zeroHashes[2],
      zeroHashes[3]
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";
    var isBobValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      BobAccountPath,
      BobAccountSiblings
    );
    expect(isBobValid).to.be.deep.eq(true);

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: OriginalBob.AccID,
          tokenType: OriginalBob.TokenType,
          balance: OriginalBob.Amount,
          nonce: 0
        }
      },
      siblings: BobAccountSiblings
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      AliceAccountMP,
      BobAccountMP
    );

    console.log("result from processTx: " + JSON.stringify(result));

    // submit batch for that transactions
  });
});
