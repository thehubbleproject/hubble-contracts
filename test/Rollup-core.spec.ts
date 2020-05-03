import * as utils from "../scripts/helpers/utils";
import {ethers} from "ethers";
contract("IncrementalTree", async function(accounts) {
  before(async function() {
    //   wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  // test if we are able to create append a leaf
  it("testing", async function() {
    var left = utils.CreateAccountLeaf(0, 10, 0, 0);

    var right = utils.CreateAccountLeaf(1, 10, 0, 0);
    var root = utils.getParentLeaf(left, right);

    var defaultHashes = await utils.defaultHashes(2);
  });
});
