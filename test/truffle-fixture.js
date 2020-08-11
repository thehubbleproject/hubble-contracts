const fs = require("fs");
// Libs
const ECVerifyLib = artifacts.require("ECVerify");
const paramManagerLib = artifacts.require("ParamManager");
const rollupUtilsLib = artifacts.require("RollupUtils");

// Contracts Deployer
const governanceContract = artifacts.require("Governance");
const MTUtilsContract = artifacts.require("MerkleTreeUtils");
const loggerContract = artifacts.require("Logger");
const tokenRegistryContract = artifacts.require("TokenRegistry");
const transferContract = artifacts.require("Transfer");
const createAccountContract = artifacts.require("CreateAccount");
const airdropContract = artifacts.require("Airdrop");
const burnConsentContract = artifacts.require("BurnConsent");
const burnExecutionContract = artifacts.require("BurnExecution");

const nameRegistryContract = artifacts.require("NameRegistry");
const incrementalTreeContract = artifacts.require("IncrementalTree");
const depositManagerContract = artifacts.require("DepositManager");
const rollupContract = artifacts.require("Rollup");
const rollupRedditContract = artifacts.require("RollupReddit");
const testTokenContract = artifacts.require("TestToken");
const merkleTreeUtilsContract = artifacts.require("MerkleTreeUtils");
const POBContract = artifacts.require("POB");

module.exports = async () => {
    var max_depth = 4;
    var maxDepositSubtreeDepth = 1;

    // deploy libs
    const ecVerifyInstance = await ECVerifyLib.new();
    ECVerifyLib.setAsDeployed(ecVerifyInstance);
    const paramManagerInstance = await paramManagerLib.new();
    paramManagerLib.setAsDeployed(paramManagerInstance);
    const rollupUtilsInstance = await rollupUtilsLib.new();
    rollupUtilsLib.setAsDeployed(rollupUtilsInstance);

    // deploy name registry
    const nameRegistryInstance = await nameRegistryContract.new();
    nameRegistryContract.setAsDeployed(nameRegistryInstance);

    // deploy governance
    const governanceInstance = await deployAndRegister(
        governanceContract,
        [],
        [max_depth, maxDepositSubtreeDepth],
        "Governance"
    );

    // deploy MTUtils
    const mtUtilsInstance = await deployAndRegister(
        MTUtilsContract,
        [paramManagerInstance],
        [nameRegistryInstance.address],
        "MERKLE_UTILS"
    );

    // deploy logger
    const loggerInstance = await deployAndRegister(
        loggerContract,
        [],
        [],
        "LOGGER"
    );

    // deploy Token registry contract
    const tokenRegistryInstance = await deployAndRegister(
        tokenRegistryContract,
        [paramManagerInstance],
        [nameRegistryInstance.address],
        "TOKEN_REGISTRY"
    );

    const transferInstance = await deployAndRegister(
        transferContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "TRANSFER"
    );

    const airdropInstance = await deployAndRegister(
        airdropContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "AIRDROP"
    );
    const burnConsentInstance = await deployAndRegister(
        burnConsentContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "BURN_CONSENT"
    );
    const burnExecutionInstance = await deployAndRegister(
        burnExecutionContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "BURN_EXECUTION"
    );

    // deploy POB contract
    const pobInstance = await deployAndRegister(POBContract, [], [], "POB");

    // deploy account tree contract
    const accountsTreeInstance = await deployAndRegister(
        incrementalTreeContract,
        [paramManagerInstance],
        [nameRegistryInstance.address],
        "ACCOUNTS_TREE"
    );
    const createAccountInstance = await deployAndRegister(
        createAccountContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "CREATE_ACCOUNT"
    );

    // deploy test token
    const testTokenInstance = await deployAndRegister(
        testTokenContract,
        [],
        [],
        "TEST_TOKEN"
    );

    const root = await getMerkleRootWithCoordinatorAccount(max_depth);
    // deploy deposit manager
    const depositManagerInstance = await deployAndRegister(
        depositManagerContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "DEPOSIT_MANAGER"
    );

    const rollupRedditInstance = await deployAndRegister(
        rollupRedditContract,
        [paramManagerInstance, rollupUtilsInstance],
        [nameRegistryInstance.address],
        "ROLLUP_REDDIT"
    );

    // deploy Rollup core
    const rollupInstance = await deployAndRegister(
        rollupContract,
        [paramManagerInstance],
        [nameRegistryInstance.address, root],
        "ROLLUP_CORE"
    );
};

async function getMerkleRootWithCoordinatorAccount(maxSize) {
    var dataLeaves = [];
    var rollupUtils = await rollupUtilsLib.deployed();
    dataLeaves = await rollupUtils.GetGenesisLeaves();
    var ZERO_BYTES32 =
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    var numOfAccsForCoord = dataLeaves.length;
    console.log(
        "Data leaves fetched from contract",
        dataLeaves,
        "count",
        dataLeaves.length
    );
    var numberOfDataLeaves = 2 ** maxSize;

    // create empty leaves
    for (var i = numOfAccsForCoord; i < numberOfDataLeaves; i++) {
        dataLeaves[i] = ZERO_BYTES32;
    }
    MTUtilsInstance = await merkleTreeUtilsContract.deployed();
    const result = await MTUtilsInstance.getMerkleRootFromLeaves(dataLeaves);
    console.log("result", result);
    return result;
}

async function deployAndRegister(contract, libs, args, name) {
    var nameRegistryInstance = await nameRegistryContract.deployed();
    var paramManagerInstance = await paramManagerLib.deployed();
    for (let i = 0; i < libs.length; i++) {
        await contract.link(libs[i]);
    }
    var contractInstance = await contract.new(...args);
    contract.setAsDeployed(contractInstance);
    await nameRegistryInstance.registerName(
        await paramManagerInstance[name](),
        contractInstance.address
    );
    return contractInstance;
}
