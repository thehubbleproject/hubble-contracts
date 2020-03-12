const MTLib = artifacts.require("MerkleTreeLib");
const MT = artifacts.require("MerkleTree");
const RollUp = artifacts.require("Rollup");
const ECVerify = artifacts.require("ECVerify");
const TokenRegistry = artifacts.require("TokenRegistry");

module.exports = async function(deployer) {
  var max_depth = 5;
  await deployer.deploy(MTLib,max_depth);
  var mtLibAddr = MTLib.address
  balanceTree = await deployer.deploy(MT,mtLibAddr);
  accountTree = await deployer.deploy(MT,mtLibAddr);
  await deployer.deploy(ECVerify);
  await deployer.link(ECVerify, RollUp);
  tokenRegistry = await deployer.deploy(TokenRegistry);
  await deployer.deploy(RollUp,balanceTree.address,accountTree.address,mtLibAddr,tokenRegistry.address);
};