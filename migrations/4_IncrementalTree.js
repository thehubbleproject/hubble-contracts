var argv = require("minimist")(process.argv.slice(2));

// Libs
const ECVerifyLib = artifacts.require("ECVerify");
const paramManagerLib = artifacts.require("ParamManager");
const rollupUtilsLib = artifacts.require("RollupUtils");

// Contracts Deployer
const governanceContract = artifacts.require("Governance");
const MTUtilsContract = artifacts.require("MerkleTreeUtils");

const nameRegistryContract = artifacts.require("NameRegistry");

module.exports = async function(deployer) {
    if (argv.dn && argv.dn == 4) {
        var max_depth = 4;
        var maxDepositSubtreeDepth = 1;

        // deploy libs
        await deployer.deploy(ECVerifyLib);
        await deployer.deploy(Types);
        await deployer.deploy(rollupUtilsLib);

        // deploy name registry
        const nameRegistryInstance = await deployer.deploy(
            nameRegistryContract
        );

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
            [ECVerifyLib, paramManagerLib, rollupUtilsLib],
            [nameRegistryInstance.address],
            "MERKLE_UTILS"
        );
    }
};

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
