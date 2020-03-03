const ethUtils = require("ethereumjs-util");
var BigNumber = require("big-number");
var ethers = require("ethers")
const MerkleTree = artifacts.require("MerkleTree");
const RollUp = artifacts.require("rollup")

contract("MerkleTree", async accounts => {
  it("emit events", async () => {
    let mt = await MerkleTree.deployed();
    var variable1 = ethUtils.bufferToHex("0x12")
    var variable2 = ethUtils.bufferToHex("0x12")
    // console.log(await mt.getkeecak(variable1))
    var result = await ethers.utils.solidityKeccak256([ 'bytes1' ], ["0x12"])
    console.log(result)
  });
});
