const Decoder = artifacts.require("Decoder");

module.exports = function(deployer) {
  deployer.deploy(Decoder);
};
