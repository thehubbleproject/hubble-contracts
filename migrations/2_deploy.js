const fs = require("fs");
// Libs
const ECVerify = artifacts.require("ECVerify");
const ParamManager = artifacts.require("ParamManager");
const RollupUtils = artifacts.require("RollupUtils");
const Types = artifacts.require("Types");

// Contracts Deployer
const governanceContract = artifacts.require("Governance");
const MTUtilsContract = artifacts.require("MerkleTreeUtils");
const loggerContract = artifacts.require("Logger");
const tokenRegistryContract = artifacts.require("TokenRegistry");


const NameRegistry = artifacts.require("NameRegistry");
const deployerContract = artifacts.require("deployer");
const IncrementalTree = artifacts.require("IncrementalTree");
const DepositManager = artifacts.require("DepositManager");
const Rollup = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const CoordinatorProxy = artifacts.require("CoordinatorProxy");
const POB = artifacts.require("POB");
const utils = "../test/helpers/utils.ts";

function writeContractAddresses(contractAddresses) {
  fs.writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  );
}

module.exports = async function (deployer) {
  // picked address from mnemoic
  var coordinator = "0x9fB29AAc15b9A4B7F17c3385939b007540f4d791";
  var max_depth = 4;
  var maxDepositSubtreeDepth = 1;

  // deploy libs
  await deployer.deploy(ECVerify);
  await deployer.deploy(Types);
  await deployer.deploy(ParamManager);
  await deployer.deploy(RollupUtils);

  // deploy name registry
  var nameRegistryInstance = await deployer.deploy(NameRegistry);

  // await deployer.link(ECVerify, deployerContract);
  // await deployer.link(Types, deployerContract);
  // await deployer.link(ParamManager, deployerContract);
  // await deployer.link(RollupUtils, deployerContract);

  // var deployerContractInstance = await deployer.deploy(
  //   deployerContract,
  //   nameRegistry.address,
  //   max_depth,
  //   maxDepositSubtreeDepth
  // );
  var paramManagerInstance = await ParamManager.deployed();

  await contractDeployer(deployer, nameRegistryInstance, paramManagerInstance, max_depth, maxDepositSubtreeDepth)
  
  // get accounts tree key
  var loggerKey = await paramManagerInstance.LOGGER();
  var loggerAddress = await nameRegistryInstance.getContractDetails(loggerKey);
  // deploy proof of burn contract
  var pobContract = await deployer.deploy(POB);
  var key = await paramManagerInstance.POB();
  await nameRegistryInstance.registerName(key, pobContract.address);

  await deployer.link(ParamManager, IncrementalTree);

  // deploy accounts tree
  var accountsTree = await deployer.deploy(
    IncrementalTree,
    nameRegistryInstance.address
  );

  var key = await paramManagerInstance.ACCOUNTS_TREE();
  await nameRegistryInstance.registerName(key, accountsTree.address);

  // deploy test token
  var testTokenInstance = await deployer.deploy(TestToken);

  var key = await paramManagerInstance.TEST_TOKEN();
  await nameRegistryInstance.registerName(key, testTokenInstance.address);

  await deployer.link(ECVerify, Rollup);
  await deployer.link(Types, Rollup);
  await deployer.link(ParamManager, Rollup);
  await deployer.link(RollupUtils, Rollup);

  var root = await getMerkleRootWithCoordinatorAccount(max_depth);

  await deployer.link(Types, DepositManager);
  await deployer.link(ParamManager, DepositManager);
  await deployer.link(RollupUtils, DepositManager);
  // deploy deposit manager
  var depositManager = await deployer.deploy(
    DepositManager,
    nameRegistryInstance.address
  );
  var key = await paramManagerInstance.DEPOSIT_MANAGER();
  await nameRegistryInstance.registerName(key, depositManager.address);

  // deploy rollup core
  var rollup = await deployer.deploy(Rollup, nameRegistryInstance.address, root);
  var key = await paramManagerInstance.ROLLUP_CORE();
  await nameRegistryInstance.registerName(key, rollup.address);

  await deployer.link(ParamManager, CoordinatorProxy);
  var coordinatorProxy = await deployer.deploy(
    CoordinatorProxy,
    nameRegistryInstance.address
  );

  await rollup.setCoordinatorProxy(coordinatorProxy.address);

  const contractAddresses = {
    AccountTree: accountsTree.address,
    ParamManager: paramManagerInstance.address,
    DepositManager: depositManager.address,
    RollupContract: rollup.address,
    CoordinatorProxy: coordinatorProxy.address,
    ProofOfBurnContract: pobContract.address,
    RollupUtilities: RollupUtils.address,
    NameRegistry: nameRegistryInstance.address,
    Logger: loggerAddress,
  };

  writeContractAddresses(contractAddresses);
};

async function getMerkleRootWithCoordinatorAccount(maxSize) {
  // coordinator account
  var coordinator =
    "0x012893657d8eb2efad4de0a91bcd0e39ad9837745dec3ea923737ea803fc8e3d";
  var dataLeaves = [];
  dataLeaves[0] = coordinator;
  var numberOfDataLeaves = 2 ** maxSize;

  // create empty leaves
  for (var i = 1; i < numberOfDataLeaves; i++) {
    dataLeaves[i] =
      "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
  }

  // get deployed name registry instance
  var nameRegistryInstance = await NameRegistry.deployed();

  // get deployed parama manager instance
  var paramManager = await ParamManager.deployed();

  // get accounts tree key
  var merkleTreeUtilKey = await paramManager.MERKLE_UTILS();

  var merkleTreeUtilsAddr = await nameRegistryInstance.getContractDetails(
    merkleTreeUtilKey
  );

  MTUtilsDeployed = await MerkleTreeUtils.at(merkleTreeUtilsAddr);
  var result = await MTUtilsDeployed.getMerkleRootFromLeaves(dataLeaves);
  console.log("result", result);

  return result;
}

async function contractDeployer(deployer, nameRegistryInstance, paramManagerInstance, maxDepth, maxDepositSubTree) {
  await deployer.link(ECVerify, MTUtilsContract);
  await deployer.link(Types, MTUtilsContract);
  await deployer.link(ParamManager, MTUtilsContract);
  await deployer.link(RollupUtils, MTUtilsContract);

  await deployer.link(ECVerify, tokenRegistryContract);
  await deployer.link(Types, tokenRegistryContract);
  await deployer.link(ParamManager, tokenRegistryContract);
  await deployer.link(RollupUtils, tokenRegistryContract);

  var governance = await deployer.deploy(governanceContract, maxDepth, maxDepositSubTree);
  var governanceParam = await paramManagerInstance.Governance();
  var x = await nameRegistryInstance.registerName(governanceParam, governance.address);
  console.log(x)
  var mtUtils = await deployer.deploy(MTUtilsContract, nameRegistryInstance.address);
  await nameRegistryInstance.registerName(await paramManagerInstance.MERKLE_UTILS(), mtUtils.address);
  throw new Error(":")
  var logger = await deployer.deploy(loggerContract);
  await nameRegistryInstance.registerName(await paramManagerInstance.LOGGER(), logger.address);
  
  var tokenRegistry = await deployer.deploy(tokenRegistryContract, nameRegistryInstance.address);
  await nameRegistryInstance.registerName(await paramManagerInstance.TOKEN_REGISTRY(), tokenRegistry.address);

}