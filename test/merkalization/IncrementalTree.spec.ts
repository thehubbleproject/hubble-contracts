const MTLib = artifacts.require("MerkleTreeLib");
const IMT = artifacts.require("IncrementalTree.sol");

import * as walletHelper from "../helpers/wallet";
import * as utils from "../helpers/utils";
contract("IncrementalTree", async function(accounts) {
  var wallets: any;

  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  it("setup correctly", async function() {
    let mtlibInstance = await MTLib.new(2, {
      from: wallets[0].getAddressString()
    });
    var firstDataBlock = "0x123";
    var secondDataBlock = "0x334";
    var dataBlocks = [firstDataBlock, secondDataBlock];
    console.log(await mtlibInstance.getMerkleRoot(dataBlocks));
  });
});
