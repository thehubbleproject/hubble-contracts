const MTLib = artifacts.require("MerkleTreeLib");

const MT = artifacts.require("MerkleTree");
const RollUp = artifacts.require("Rollup");
const ECVerify = artifacts.require("ECVerify");
const TokenRegistry = artifacts.require("TokenRegistry");
const TestToken = artifacts.require("TestToken");
const Logger = artifacts.require("Logger");

const fs = require("fs");

function writeContractAddresses(contractAddresses) {
  fs.writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  );
}
module.exports = async function(deployer) {
  // picked address from mnemoic
  var coordinator = "0x9fB29AAc15b9A4B7F17c3385939b007540f4d791";
  var max_depth = 5;

  await deployer.deploy(MTLib, max_depth);
  var mtLibAddr = MTLib.address;

  balanceTree = await deployer.deploy(MT, mtLibAddr);
  accountTree = await deployer.deploy(MT, mtLibAddr);

  await deployer.deploy(ECVerify);
  await deployer.link(ECVerify, RollUp);

  logger = await deployer.deploy(Logger);
  tokenRegistry = await deployer.deploy(TokenRegistry, coordinator);

  rollupContract = await deployer.deploy(
    RollUp,
    balanceTree.address,
    accountTree.address,
    mtLibAddr,
    tokenRegistry.address,
    logger.address,
    coordinator
  );

  await deployer.deploy(TestToken, coordinator);
  console.log("writing contract addresses to file...");

  const contractAddresses = {
    Coordinator: coordinator,
    MerkleTreeLib: MTLib.address,
    BalanceTree: balanceTree.address,
    AccountTree: accountTree.address,
    ECVeridy: ECVerify.address,
    TokenRegistry: TokenRegistry.address,
    TestTokenContract: TestToken.address,
    RollupContract: rollupContract.address,
    Logger: logger.address
  };
  writeContractAddresses(contractAddresses);
}
