const ethUtils = require("ethereumjs-util");
var BigNumber = require("big-number");

const MerkleTree = artifacts.require("MerkleTree");

contract("MerkleTree", async accounts => {
  it("we should be able to create a merkle root", async () => {
    let mt = await MerkleTree.deployed();
    // var result = await mt.decodeTx(
    //   ethUtils.bufferToHex(
    //     "0x00000001000000020000000300000004000048656c6c6f2066726f6d2041444d466163746f72792e636f6d000000000000000000000000000000000000000000000000000000000000000000000000000000"
    //   )
    // );
    var variable1 = ethUtils.bufferToHex("1")
    var variable2 = ethUtils.bufferToHex("2")
    var result = await mt.getMerkleRoot(variable1,variable2)
    console.log(result)
  });
});
