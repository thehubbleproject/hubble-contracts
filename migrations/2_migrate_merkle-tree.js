
const MT = artifacts.require("MerkleTree");
const RollUp = artifacts.require("Rollup");

module.exports = async function(deployer) {
  await deployer.deploy(MT);
  await deployer.deploy(RollUp,MT.address);
};