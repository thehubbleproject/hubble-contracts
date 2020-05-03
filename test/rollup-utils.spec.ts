import * as utils from "./helpers/utils";
import {ethers} from "ethers";
import * as walletHelper from "./helpers/wallet";
const RollupUtils = artifacts.require("RollupUtils");
contract("RollupUtils", async function(accounts) {
  var wallets: any;
  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  // test if we are able to create append a leaf
  it("test if account hash is correctly generated", async function() {
    var Alice = {
      Address: wallets[0].getAddressString(),
      Pubkey: wallets[0].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 1,
      Path: "0000",
      Nonce: 0
    };

    var AliceAccountLeaf = utils.CreateAccountLeaf(
      Alice.AccID,
      Alice.Amount,
      Alice.Nonce,
      Alice.TokenType
    );
    var rollupUtils = await RollupUtils.deployed();
    var data = {
      ID: Alice.AccID,
      tokenType: Alice.TokenType,
      balance: Alice.Amount,
      nonce: Alice.Nonce
    };
    var accountHash = await rollupUtils.getAccountHash(
      data.ID,
      data.balance,
      data.nonce,
      data.tokenType
    );
    assert.equal(AliceAccountLeaf, accountHash, "Account hash mismatch");
  });
});
