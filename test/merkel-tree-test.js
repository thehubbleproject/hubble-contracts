const ethUtils = require("ethereumjs-util");
var BigNumber = require("big-number");

const MerkleTree = artifacts.require("MerkleTree");

contract("MerkleTree", async accounts => {
  it("we should be able to obtain a merkle root", async () => {
    let mt = await MerkleTree.deployed();
    var variable1 = ethUtils.bufferToHex("0x12")
    var variable2 = ethUtils.bufferToHex("0x12")
    var result = await mt.getMerkleRoot([variable1,variable2])
    console.log("merkle tree root obtained",result)
  });
});
