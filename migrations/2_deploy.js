const ECVerify = artifacts.require("ECVerify");
const ParamManager = artifacts.require("ParamManager");
const RollupUtils = artifacts.require("RollupUtils");
const Types = artifacts.require("Types");
const NameRegistry = artifacts.require("NameRegistry");
const deployerContract = artifacts.require("deployer");
const fs = require("fs");
const Tree = artifacts.require("Tree");
const IncrementalTree = artifacts.require("IncrementalTree");
const DepositManager = artifacts.require("DepositManager");
const Rollup = artifacts.require("Rollup");
const TokenRegistry = artifacts.require("TokenRegistry");
const TestToken = artifacts.require("TestToken");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const POB = artifacts.require("POB");
function writeContractAddresses(contractAddresses) {
  fs.writeFileSync(
    `${process.cwd()}/contractAddresses.json`,
    JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
  );
}
module.exports = async function(deployer) {
  // picked address from mnemoic
  var coordinator = "0x9fB29AAc15b9A4B7F17c3385939b007540f4d791";
  var max_depth = 4;
  var maxDepositSubtreeDepth = 2;

  // deploy libs
  await deployer.deploy(ECVerify);
  await deployer.deploy(Types);
  await deployer.deploy(ParamManager);
  await deployer.deploy(RollupUtils);

  // deploy name registry
  var nameRegistry = await deployer.deploy(NameRegistry);

  await deployer.link(ECVerify, deployerContract);
  await deployer.link(Types, deployerContract);
  await deployer.link(ParamManager, deployerContract);
  await deployer.link(RollupUtils, deployerContract);

  var deployerContractInstance = await deployer.deploy(
    deployerContract,
    nameRegistry.address,
    max_depth,
    maxDepositSubtreeDepth
  );

  var paramManagerInstance = await ParamManager.deployed();

  await deployer.link(ParamManager, Tree);

  // deploy proof of burn contract
  var pobContract = await deployer.deploy(POB);
  var key = await paramManagerInstance.POB();
  await nameRegistry.registerName(key, pobContract.address);

  // deploy balances tree
  var balancesTree = await deployer.deploy(Tree, nameRegistry.address);
  var key = await paramManagerInstance.BALANCES_TREE();
  await nameRegistry.registerName(key, balancesTree.address);

  await deployer.link(ParamManager, IncrementalTree);

  // deploy accounts tree
  var accountsTree = await deployer.deploy(
    IncrementalTree,
    nameRegistry.address
  );

  var key = await paramManagerInstance.ACCOUNTS_TREE();
  await nameRegistry.registerName(key, accountsTree.address);

  await deployer.link(Types, DepositManager);
  await deployer.link(ParamManager, DepositManager);
  await deployer.link(RollupUtils, DepositManager);
  // deploy deposit manager
  var depositManager = await deployer.deploy(
    DepositManager,
    nameRegistry.address
  );

  var key = await paramManagerInstance.DEPOSIT_MANAGER();

  await nameRegistry.registerName(key, depositManager.address);

  // deploy test token
  var testTokenInstance = await deployer.deploy(TestToken);

  var key = await paramManagerInstance.TEST_TOKEN();
  await nameRegistry.registerName(key, testTokenInstance.address);

  await deployer.link(ECVerify, Rollup);
  await deployer.link(Types, Rollup);
  await deployer.link(ParamManager, Rollup);
  await deployer.link(RollupUtils, Rollup);

  // deploy rollup core
  var rollup = await deployer.deploy(Rollup, nameRegistry.address);
  var key = await paramManagerInstance.ROLLUP_CORE();
  await nameRegistry.registerName(key, rollup.address);

  const contractAddresses = {
    // MerkleUtils: MTLib.address,
    BalanceTree: balancesTree.address,
    AccountTree: accountsTree.address,
    // ECVeridy: ECVerify.address,
    // TokenRegistry: TokenRegistry.address,
    // TestTokenContract: TestToken.address,
    RollupContract: rollup.address
  };
  writeContractAddresses(contractAddresses);
};
