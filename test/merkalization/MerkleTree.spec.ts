const MTLib = artifacts.require("MerkleTreeLib");
const IMT = artifacts.require("IncrementalTree.sol");

import * as walletHelper from "../helpers/wallet";
import * as utils from "../helpers/utils";
// Test all stateless operations
contract("MerkelTreeLib", async function(accounts) {
  var wallets: any;
  var depth: number = 2;
  var firstDataBlock = "0x123";
  var secondDataBlock = "0x334";
  var thirdDataBlock = "0x4343";
  var fourthDataBlock = "0x334";

  before(async function() {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
  });

  // test if the get parent utility we have for the testcase returns the same result as the contract
  it("test get parent", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });
    utils.Hash(firstDataBlock);
    let localHash = utils.getParent(firstDataBlock, secondDataBlock);
    let contractHash = await mtlibInstance.getParent(
      utils.Hash(firstDataBlock),
      utils.Hash(secondDataBlock)
    );
    expect(localHash).to.be.deep.eq(contractHash);
  });

  it("test stateles merkle tree ops", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });
    var dataBlocks = [
      firstDataBlock,
      secondDataBlock,
      thirdDataBlock,
      fourthDataBlock
    ];
    var root = await mtlibInstance.getMerkleRoot(dataBlocks);
    var path: string = "00";

    var siblings: Array<string> = [
      secondDataBlock,
      utils.getParent(thirdDataBlock, fourthDataBlock)
    ];
    var contractHash = await mtlibInstance.computeInclusionProofRoot(
      firstDataBlock,
      path,
      siblings
    );
    expect(root).to.be.deep.eq(contractHash);
  });
});
// contract("IncrementalTree", async function(accounts) {
//   var wallets: any;

//   before(async function() {
//     wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
//   });

//   it("setup correctly", async function() {
//     let mtlibInstance = await MTLib.new(2, {
//       from: wallets[0].getAddressString()
//     });
//     var firstDataBlock = "0x123";
//     var secondDataBlock = "0x334";
//     var dataBlocks = [firstDataBlock, secondDataBlock];
//     console.log(await mtlibInstance.getMerkleRoot(dataBlocks));
//   });
// });
