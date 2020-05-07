import * as utils from "../scripts/helpers/utils";
import {ethers} from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
contract("RollupCore", async function(accounts) {
  var wallets: any;
  let depositManagerInstance = await DepositManager.deployed();
  var testTokenInstance = await TestToken.deployed();
  let rollupCoreInstance = await RollupCore.deployed();
  var MTutilsInstance = await utils.getMerkleTreeUtils();
  let testToken = await TestToken.deployed();
  let tokenRegistryInstance = await utils.getTokenRegistry();
  let IMTInstance = await IMT.deployed();
  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  // test if we are able to create append a leaf
  it("make a deposit of 2 accounts", async function() {
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
  });

  it("submit new batch", async function() {
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
    var coordinatorPubkey =
      "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    var maxSize = 4;
    var defaultHashes: any = utils.defaultHashes(4);
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

    var AlicePDAsiblings = [
      coordinatorPubkey,
      utils.getParentLeaf(OriginalBob.Pubkey, defaultHashes[0]),
      defaultHashes[2],
      defaultHashes[3]
    ];

    var BobPDAsiblings = [
      defaultHashes[0],
      utils.getParentLeaf(coordinatorPubkey, OriginalAlice.Pubkey),
      defaultHashes[2],
      defaultHashes[3]
    ];

    var alicePDAProof = {
      _pda: {
        pathToPubkey: "1",
        pubkey_leaf: {pubkey: OriginalAlice.Pubkey}
      },
      siblings: AlicePDAsiblings
    };

    var bobPDAProof = {
      _pda: {
        pathToPubkey: "2",
        pubkey_leaf: {pubkey: OriginalBob.Pubkey}
      },
      siblings: BobPDAsiblings
    };


    var tx = {
      from: {
        ID: ;
        tokenType: ;
        balance: ;
        nonce: number | BigNumber | string;
      };
      to: {
        ID: number | BigNumber | string;
        tokenType: number | BigNumber | string;
        balance: number | BigNumber | string;
        nonce: number | BigNumber | string;
      };
      tokenType: number | BigNumber | string;
      amount: number | BigNumber | string;
      signature: string;
    },

    // process transaction validity with process tx
    await rollupCoreInstance.processTx(currentRoot,accountRoot,);

    // submit batch for that transactions
  }); 
});
