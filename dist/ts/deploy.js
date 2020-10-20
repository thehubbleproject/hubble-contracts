"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployAll = void 0;
const ParamManagerFactory_1 = require("../types/ethers-contracts/ParamManagerFactory");
const NameRegistryFactory_1 = require("../types/ethers-contracts/NameRegistryFactory");
const GovernanceFactory_1 = require("../types/ethers-contracts/GovernanceFactory");
const LoggerFactory_1 = require("../types/ethers-contracts/LoggerFactory");
const TokenRegistryFactory_1 = require("../types/ethers-contracts/TokenRegistryFactory");
const PobFactory_1 = require("../types/ethers-contracts/PobFactory");
const TransferFactory_1 = require("../types/ethers-contracts/TransferFactory");
const MassMigrationFactory_1 = require("../types/ethers-contracts/MassMigrationFactory");
const TestTokenFactory_1 = require("../types/ethers-contracts/TestTokenFactory");
const DepositManagerFactory_1 = require("../types/ethers-contracts/DepositManagerFactory");
const RollupFactory_1 = require("../types/ethers-contracts/RollupFactory");
const BlsAccountRegistryFactory_1 = require("../types/ethers-contracts/BlsAccountRegistryFactory");
const ethers_contracts_1 = require("../types/ethers-contracts");
const state_1 = require("./state");
const utils_1 = require("./utils");
async function waitAndRegister(contract, name, verbose, nameRegistry, registryKey) {
    await contract.deployed();
    if (verbose)
        console.log("Deployed", name, "at", contract.address);
    if (nameRegistry) {
        if (!registryKey)
            throw Error(`Need registry key for ${name}`);
        const tx = await nameRegistry.registerName(registryKey, contract.address);
        await tx.wait();
        if (verbose)
            console.log("Registered", name, "on nameRegistry");
    }
}
async function deployAll(signer, parameters, verbose = false) {
    // deploy libs
    const paramManager = await new ParamManagerFactory_1.ParamManagerFactory(signer).deploy();
    await waitAndRegister(paramManager, "paramManager", verbose);
    const clientFrondend = await new ethers_contracts_1.ClientFrontendFactory(signer).deploy();
    await waitAndRegister(clientFrondend, "clientFrondend", verbose);
    // deploy name registry
    const nameRegistry = await new NameRegistryFactory_1.NameRegistryFactory(signer).deploy();
    await waitAndRegister(nameRegistry, "nameRegistry", verbose);
    // deploy governance
    const governance = await new GovernanceFactory_1.GovernanceFactory(signer).deploy(parameters.MAX_DEPOSIT_SUBTREE_DEPTH, parameters.TIME_TO_FINALISE);
    await waitAndRegister(governance, "governance", verbose, nameRegistry, await paramManager.governance());
    // deploy logger
    const logger = await new LoggerFactory_1.LoggerFactory(signer).deploy();
    await waitAndRegister(logger, "logger", verbose, nameRegistry, await paramManager.logger());
    const allLinkRefs = {
        __$b941c30c0f5422d8b714f571f17d94a5fd$__: paramManager.address
    };
    const blsAccountRegistry = await new BlsAccountRegistryFactory_1.BlsAccountRegistryFactory(signer).deploy(logger.address);
    await waitAndRegister(blsAccountRegistry, "blsAccountRegistry", verbose, nameRegistry, await paramManager.accountRegistry());
    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistryFactory_1.TokenRegistryFactory(allLinkRefs, signer).deploy(nameRegistry.address);
    await waitAndRegister(tokenRegistry, "tokenRegistry", verbose, nameRegistry, await paramManager.tokenRegistry());
    const massMigration = await new MassMigrationFactory_1.MassMigrationFactory(signer).deploy();
    await waitAndRegister(massMigration, "mass_migs", verbose, nameRegistry, await paramManager.massMigration());
    const transfer = await new TransferFactory_1.TransferFactory(signer).deploy();
    await waitAndRegister(transfer, "transfer", verbose, nameRegistry, await paramManager.transferSimple());
    // deploy POB contract
    const pob = await new PobFactory_1.PobFactory(signer).deploy();
    await waitAndRegister(pob, "pob", verbose, nameRegistry, await paramManager.proofOfBurn());
    // deploy test token
    const testToken = await new TestTokenFactory_1.TestTokenFactory(signer).deploy();
    await waitAndRegister(testToken, "testToken", verbose, nameRegistry, await paramManager.testToken());
    await tokenRegistry.requestRegistration(testToken.address);
    await tokenRegistry.finaliseRegistration(testToken.address);
    const spokeRegistry = await new ethers_contracts_1.SpokeRegistryFactory(signer).deploy();
    await waitAndRegister(spokeRegistry, "spokeRegistry", verbose, nameRegistry, await paramManager.spokeRegistry());
    const vault = await new ethers_contracts_1.VaultFactory(allLinkRefs, signer).deploy(nameRegistry.address);
    await waitAndRegister(vault, "vault", verbose, nameRegistry, await paramManager.vault());
    // deploy deposit manager
    const depositManager = await new DepositManagerFactory_1.DepositManagerFactory(allLinkRefs, signer).deploy(nameRegistry.address);
    await waitAndRegister(depositManager, "depositManager", verbose, nameRegistry, await paramManager.depositManager());
    const root = parameters.GENESIS_STATE_ROOT ||
        (await getMerkleRootWithCoordinatorAccount(parameters));
    // deploy Rollup core
    const rollup = await new RollupFactory_1.RollupFactory(allLinkRefs, signer).deploy(nameRegistry.address, root);
    await waitAndRegister(rollup, "rollup", verbose, nameRegistry, await paramManager.rollupCore());
    await vault.setRollupAddress();
    const withdrawManager = await new ethers_contracts_1.WithdrawManagerFactory(allLinkRefs, signer).deploy(nameRegistry.address);
    await waitAndRegister(withdrawManager, "withdrawManager", verbose, nameRegistry, await paramManager.withdrawManager());
    await spokeRegistry.registerSpoke(withdrawManager.address);
    return {
        paramManager,
        clientFrondend,
        nameRegistry,
        governance,
        logger,
        blsAccountRegistry,
        tokenRegistry,
        transfer,
        massMigration,
        pob,
        testToken,
        spokeRegistry,
        vault,
        depositManager,
        rollup,
        withdrawManager
    };
}
exports.deployAll = deployAll;
async function getMerkleRootWithCoordinatorAccount(parameters) {
    const state0 = state_1.State.new(0, 0, 0, 0);
    const state1 = state_1.State.new(1, 0, 0, 0);
    const dataLeaves = [state0.toStateLeaf(), state1.toStateLeaf()];
    const ZERO_BYTES32 = "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    for (let i = dataLeaves.length; i < 2 ** parameters.MAX_DEPTH; i++) {
        dataLeaves[i] = ZERO_BYTES32;
    }
    const result = await utils_1.merklise(dataLeaves, parameters.MAX_DEPTH);
    return result;
}
//# sourceMappingURL=deploy.js.map