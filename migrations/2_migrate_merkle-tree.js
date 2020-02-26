
const MT = artifacts.require("MerkleTree");
const RollUp = artifacts.require("Rollup");
const ECVerify = artifacts.require("ECVerify");


module.exports = async function(deployer) {
  await deployer.deploy(MT);
  await deployer.deploy(ECVerify);
  deployer.link(ECVerify, RollUp)
  await deployer.deploy(RollUp,MT.address);
};