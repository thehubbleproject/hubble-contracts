import * as utils from "../../scripts/helpers/utils";
import * as walletHelper from "../..//scripts/helpers/wallet";

const RollupUtils = artifacts.require("RollupUtils");

contract("RollupUtils", async function (accounts) {
  var wallets: any;
  before(async function () {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  // test if we are able to create append a leaf
  /* it("test if account hash is correctly generated", async function () { */
  /*   var Alice = { */
  /*     Address: wallets[0].getAddressString(), */
  /*     Pubkey: wallets[0].getPublicKeyString(), */
  /*     Amount: 10, */
  /*     TokenType: 1, */
  /*     AccID: 1, */
  /*     Path: "0000", */
  /*     Nonce: 0, */
  /*   }; */

  /*   var AliceAccountLeaf = utils.CreateAccountLeaf( */
  /*     Alice.AccID, */
  /*     Alice.Amount, */
  /*     Alice.Nonce, */
  /*     Alice.TokenType */
  /*   ); */
  /*   var rollupUtils = await RollupUtils.deployed(); */
  /*   var data = { */
  /*     ID: Alice.AccID, */
  /*     tokenType: Alice.TokenType, */
  /*     balance: Alice.Amount, */
  /*     nonce: Alice.Nonce, */
  /*   }; */
  /*   var accountHash = await rollupUtils.getAccountHash( */
  /*     data.ID, */
  /*     data.balance, */
  /*     data.nonce, */
  /*     data.tokenType */
  /*   ); */
  /*   assert.equal(AliceAccountLeaf, accountHash, "Account hash mismatch"); */
  /* }); */
  // it("test if tx is correctly encoded to bytes and hash", async function () {
  //   var rollupUtils = await RollupUtils.deployed();
  //   var tx = {
  //     fromIndex: 1,
  //     toIndex: 2,
  //     tokenType: 1,
  //     amount: 1,
  //     signature:
  //       "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
  //   };

  //   var expectedResult = utils.HashFromTx(
  //     tx.fromIndex,
  //     tx.toIndex,
  //     tx.tokenType,
  //     tx.amount
  //   );

  //   var result = await rollupUtils.getTxHash(
  //     tx.fromIndex,
  //     tx.toIndex,
  //     tx.tokenType,
  //     tx.amount
  //   );
  //   assert.equal(expectedResult, result, "Account hash mismatch");
  // });

  it("test account encoding and decoding", async function () {
    var rollupUtils = await RollupUtils.deployed();
    var account = {
      ID: 1,
      tokenType: 2,
      balance: 3,
      nonce: 4,
    };
    
    var accountBytes = await
    rollupUtils.BytesFromAccountDeconstructed(account.ID, account.balance,
                                              account.nonce, account.tokenType)
    console.log("accountBytes", accountBytes);

    var regeneratedAccount = await rollupUtils.AccountFromBytes(accountBytes);
    console.log("regeneratedAccount", regeneratedAccount);
    
    var tx = {
      fromIndex: 1,
      toIndex: 1,
      tokenType: 1, 
      amount: 1,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };
    
    var txBytes = await rollupUtils.BytesFromTxDeconstructed(tx.fromIndex,
                                                               tx.toIndex,tx.tokenType,
    tx.amount)
    console.log("txBytes", txBytes)

    var txData = await rollupUtils.TxFromBytes(txBytes)
    console.log("tx data",txData)
    // assert.equal(expectedResult, result, "Account hash mismatch");
  });
});
