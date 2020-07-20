const fs = require("fs");
var argv = require('minimist')(process.argv.slice(2));
// Libs
const rollupUtilsLib = artifacts.require("RollupUtils");

module.exports = async function (deployer) {
  if (argv.dn && argv.dn == 3) {
    await deployer.deploy(rollupUtilsLib);
    const instance = await rollupUtilsLib.deployed;
    console.log("rollupUtilsLibAddr :", instance.address)
  }
};