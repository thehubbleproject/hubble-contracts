const ethUtils = require("ethereumjs-util");
var BigNumber = require("big-number");

// const MerkleTree = artifacts.require("MerkleTree");
const { MerkleTree } = require('merkletreejs')
const SHA256 = require('crypto-js/sha256')

contract("MerkleTree", async accounts => {
  // it("create a merkle root with even number of elements", async () => {
  //   let mt = await MerkleTree.deployed();
  //   var variable1 = ethUtils.bufferToHex("0x12")
  //   var variable2 = ethUtils.bufferToHex("0x12")
  //   var result = await mt.getMerkleRoot([variable1,variable2])
  //   console.log("merkle tree root obtained",result)
  // });

  // it("create a merkle root with odd number of elements", async () => {
  //   let mt = await MerkleTree.deployed();
  //   var variable1 = ethUtils.toBuffer("0x12")
  //   // var variable2 = ethUtils.toBuffer("0x12")
  //   // var variable3 = ethUtils.toBuffer("0x12")
  //   // var input = variable1 + variable2 + variable3
  
  //   console.log("input ", variable1)
  //   var result = await mt.getMerkleRoot([variable1])
  //   console.log("merkle tree root obtained",result)
  // });
  it("create a merkle root with 1 element", async () => {
    // let mt = await MerkleTree.deployed();
    // var variable1 = ethUtils.bufferToHex("0x2aa012a32db4297b6c1ec06b81e498154b4e8d46")
    // console.log("variable being passed to the tree",[variable1])
    // var result = await mt.getMerkleRoot([variable1])
    // console.log("merkle tree root obtained",result)

const leaves = ['0x2aa012a32db4297b6c1ec06b81e498154b4e8d46'].map(x => SHA256(x))
console.log("leaves", leaves)
const tree = new MerkleTree(leaves, SHA256)
const root = tree.getRoot().toString('hex')
console.log(root)
  });
});
