const MTLib = artifacts.require("MerkleTreeLib");
const MT = artifacts.require("MerkleTree");
const RollUp = artifacts.require("Rollup");
const ECVerify = artifacts.require("ECVerify");
const TokenRegistry = artifacts.require("TokenRegistry");
const TestToken = artifacts.require("TestToken");
// var Web3 = require('web3');
// var web3 = new Web3();


module.exports = async function(deployer) {
  // picked address from mnemoic
  var coordinator = "0x9fB29AAc15b9A4B7F17c3385939b007540f4d791"
  var max_depth = 5;
  
  await deployer.deploy(MTLib,max_depth);
  var mtLibAddr = MTLib.address
  
  balanceTree = await deployer.deploy(MT,mtLibAddr);
  accountTree = await deployer.deploy(MT,mtLibAddr);
  
  await deployer.deploy(ECVerify);
  await deployer.link(ECVerify, RollUp);
  
  tokenRegistry = await deployer.deploy(TokenRegistry,coordinator);
  
  await deployer.deploy(RollUp,balanceTree.address,accountTree.address,mtLibAddr,tokenRegistry.address,coordinator);
  
  await deployer.deploy(TestToken,coordinator);
};