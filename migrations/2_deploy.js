const fs = require("fs");
var argv = require("minimist")(process.argv.slice(2));
const { ethers } = require("ethers");
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
const utils = "../test/helpers/utils.ts";

function writeContractAddresses(contractAddresses) {
    fs.writeFileSync(
        `${process.cwd()}/contractAddresses.json`,
        JSON.stringify(contractAddresses, null, 2) // Indent 2 spaces
    );
}

async function deploy(deployer) {
    var max_depth = 17;
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

    const root = await getMerkleRootWithCoordinatorAccount(max_depth);
    console.log("root", root);
    // deploy deposit manager
    const depositManagerInstance = await deployAndRegister(
        deployer,
        depositManagerContract,
        [Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "DEPOSIT_MANAGER"
    );

    console.log("here");
    const rollupRedditInstance = await deployAndRegister(
        deployer,
        rollupRedditContract,
        [Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address],
        "ROLLUP_REDDIT"
    );
    console.log("here");

    // deploy Rollup core
    const rollupInstance = await deployAndRegister(
        deployer,
        rollupContract,
        [ECVerifyLib, Types, paramManagerLib, rollupUtilsLib],
        [nameRegistryInstance.address, root],
        "ROLLUP_CORE"
    );
    console.log("here");

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
        RollupReddit: rollupRedditInstance.address,
        TokenRegistry: tokenRegistryInstance.address,
        TestToken: testTokenInstance.address,
        Governance: governanceInstance.address
    };

    writeContractAddresses(contractAddresses);
}

module.exports = async function(deployer) {
    if (!argv.dn) {
        await deploy(deployer);
    }
};

// returns parent node hash given child node hashes
function getParentLeaf(left, right) {
    if (left == "" || right == "") {
        return;
    }
    var abiCoder = ethers.utils.defaultAbiCoder;
    var hash = ethers.utils.keccak256(
        abiCoder.encode(["bytes32", "bytes32"], [left, right])
    );
    return hash;
}
async function getZeroHash(zeroValue) {
    const abiCoder = ethers.utils.defaultAbiCoder;
    return ethers.utils.keccak256(abiCoder.encode(["uint256"], [zeroValue]));
}
async function defaultHashes(depth) {
    const zeroValue = 0;
    const hashes = [];
    hashes[0] = getZeroHash(zeroValue);
    for (let i = 1; i < depth; i++) {
        hashes[i] = getParentLeaf(hashes[i - 1], hashes[i - 1]);
    }

    return hashes;
}
async function getMerkleRoot(dataLeaves, maxDepth) {
    var nextLevelLength = dataLeaves.length;
    var currentLevel = 0;
    var nodes = dataLeaves.slice();
    var defaultHashesForLeaves = defaultHashes(maxDepth);
    // create a merkle root to see if this is valid
    while (nextLevelLength > 1) {
        currentLevel += 1;
        // Calculate the nodes for the currentLevel
        for (var i = 0; i < nextLevelLength / 2; i++) {
            nodes[i] = getParentLeaf(nodes[i * 2], nodes[i * 2 + 1]);
        }
        nextLevelLength = nextLevelLength / 2;
        // Check if we will need to add an extra node
        if (nextLevelLength % 2 == 1 && nextLevelLength != 1) {
            nodes[nextLevelLength] = defaultHashesForLeaves[currentLevel];
            nextLevelLength += 1;
        }
    }
    return nodes[0];
}
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
    var result;
    if ((maxSize = 17)) {
        result =
            "0x1d730588ec5ed60b391cd47b05eea169e15b4a5277d7378e0cb07826fca897c6";
    } else {
        MTUtilsInstance = await merkleTreeUtilsContract.deployed();
        result = await MTUtilsInstance.getMerkleRootFromLeaves(dataLeaves);
    }
    console.log("result", result);
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
