import * as utils from "../scripts/helpers/utils";
import {ethers} from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
contract("RollupCore", async function(accounts) {
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

    var txs: string[] = [
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d"
    ];

    await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
      subtreeDepth,
      _zero_account_mp,
      txs,
      newRoot
    );
  });

  it("submit new batch", async function() {
    let rollupCoreInstance = await RollupCore.deployed();
    var txs: string[] = [
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d"
    ];
    var newRoot =
      "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";

    await rollupCoreInstance.submitBatch(txs, newRoot);
  });
});
