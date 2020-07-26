const fs = require("fs");
const argv = require("minimist")(process.argv.slice(2));
const { ZERO_BYTES32_HASH } = require("../scripts/helpers/constants");
const { RedditProfile } = require("../scripts/helpers/constants");

// Libs
const ECVerifyLib = artifacts.require("ECVerify");
const paramManagerLib = artifacts.require("ParamManager");
const rollupUtilsLib = artifacts.require("RollupUtils");
const Types = artifacts.require("Types");

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

function writeContractAddresses(contractAddresses) {
    fs.writeFileSync(
        `${process.cwd()}/contractAddresses.json`,
        JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
    );
}

async function deploy(deployer) {
    var max_depth = 4;
    var maxDepositSubtreeDepth = 1;

    // deploy libs
    await deployer.deploy(ECVerifyLib);
    await deployer.deploy(Types);
    const paramManagerInstance = await deployer.deploy(paramManagerLib);
    await deployer.deploy(rollupUtilsLib);

    // deploy name registry
    const nameRegistryInstance = await deployer.deploy(nameRegistryContract);

    // deploy governance
    const governanceInstance = await deployAndRegister(
        deployer,
        governanceContract,
        [],
        [max_depth, maxDepositSubtreeDepth],
        "Governance"
    );

    // deploy MTUtils
    const mtUtilsInstance = await deployAndRegister(
        deployer,
        MTUtilsContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "MERKLE_UTILS"
    );

    // deploy logger
    const loggerInstance = await deployAndRegister(
        deployer,
        loggerContract,
        [],
        [],
        "LOGGER"
    );

    // deploy Token registry contract
    const tokenRegistryInstance = await deployAndRegister(
        deployer,
        tokenRegistryContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "TOKEN_REGISTRY"
    );

    const transferInstance = await deployAndRegister(
        deployer,
        transferContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "TRANSFER"
    );

    const airdropInstance = await deployAndRegister(
        deployer,
        airdropContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "AIRDROP"
    );
    const burnConsentInstance = await deployAndRegister(
        deployer,
        burnConsentContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "BURN_CONSENT"
    );
    const burnExecutionInstance = await deployAndRegister(
        deployer,
        burnExecutionContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "BURN_EXECUTION"
    );

    // deploy POB contract
    const pobInstance = await deployAndRegister(
        deployer,
        POBContract,
        [],
        [],
        "POB"
    );

    // deploy account tree contract
    const accountsTreeInstance = await deployAndRegister(
        deployer,
        incrementalTreeContract,
        [paramManagerLib],
        [nameRegistryInstance.address],
        "ACCOUNTS_TREE"
    );
    const createAccountInstance = await deployAndRegister(
        deployer,
        createAccountContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "CREATE_ACCOUNT"
    );

    // deploy test token
    const testTokenInstance = await deployAndRegister(
        deployer,
        testTokenContract,
        [],
        [],
        "TEST_TOKEN"
    );

    // deploy deposit manager
    const depositManagerInstance = await deployAndRegister(
        deployer,
        depositManagerContract,
        [Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address, RedditProfile.pubkeyHash],
        "DEPOSIT_MANAGER"
    );

    const rollupRedditInstance = await deployAndRegister(
        deployer,
        rollupRedditContract,
        [Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "ROLLUP_REDDIT"
    );

    const root = await getMerkleRootWithCoordinatorAccount(max_depth);

    // deploy Rollup core
    const rollupInstance = await deployAndRegister(
        deployer,
        rollupContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address, root],
        "ROLLUP_CORE"
    );

    const contractAddresses = {
        AccountTree: accountsTreeInstance.address,
        ParamManager: paramManagerInstance.address,
        DepositManager: depositManagerInstance.address,
        RollupContract: rollupInstance.address,
        ProofOfBurnContract: pobInstance.address,
        RollupUtilities: rollupUtilsLib.address,
        NameRegistry: nameRegistryInstance.address,
        Logger: loggerInstance.address,
        MerkleTreeUtils: mtUtilsInstance.address,
        Transfer: transferInstance.address,
        CreateAccount: createAccountInstance.address,
        Airdrop: airdropInstance.address,
        BurnConsent: burnConsentInstance.address,
        BurnExecution: burnExecutionInstance.address,
        RollupReddit: rollupRedditInstance.address
    };

    writeContractAddresses(contractAddresses);
}

module.exports = async function(deployer) {
    if (!argv.dn) {
        await deploy(deployer);
    }
};

async function getMerkleRootWithCoordinatorAccount(maxSize) {
    const rollupUtils = await rollupUtilsLib.deployed();
    const MTUtilsInstance = await merkleTreeUtilsContract.deployed();

    const dataLeaves = await rollupUtils.GetGenesisLeaves();
    const numOfAccsForCoord = dataLeaves.length;
    console.log(
        "Data leaves fetched from contract",
        dataLeaves,
        "count",
        dataLeaves.length
    );
    const numberOfDataLeaves = 2 ** maxSize;
    // create empty leaves
    for (let i = numOfAccsForCoord; i < numberOfDataLeaves; i++) {
        dataLeaves[i] = ZERO_BYTES32_HASH;
    }
    const result = await MTUtilsInstance.getMerkleRootFromLeaves(dataLeaves);
    return result;
}

async function deployAndRegister(deployer, contract, libs, args, name) {
    var nameRegistryInstance = await nameRegistryContract.deployed();
    var paramManagerInstance = await paramManagerLib.deployed();

    for (let i = 0; i < libs.length; i++) {
        await deployer.link(libs[i], contract);
    }
    var contractInstance = await deployer.deploy(contract, ...args);
    await nameRegistryInstance.registerName(
        await paramManagerInstance[name](),
        contractInstance.address
    );
    return contractInstance;
}
