
const MerkleTree = artifacts.require("MerkleTree");

module.exports = function(deployer) {
  deployer.deploy(MerkleTree);
};
