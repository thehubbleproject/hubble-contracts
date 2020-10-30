import { ParamManagerFactory } from "../types/ethers-contracts/ParamManagerFactory";
import { NameRegistryFactory } from "../types/ethers-contracts/NameRegistryFactory";
import { NameRegistry } from "../types/ethers-contracts/NameRegistry";
import { LoggerFactory } from "../types/ethers-contracts/LoggerFactory";
import { TokenRegistryFactory } from "../types/ethers-contracts/TokenRegistryFactory";
import { PobFactory } from "../types/ethers-contracts/PobFactory";
import { TransferFactory } from "../types/ethers-contracts/TransferFactory";
import { MassMigrationFactory } from "../types/ethers-contracts/MassMigrationFactory";
import { TestTokenFactory } from "../types/ethers-contracts/TestTokenFactory";
import { DepositManagerFactory } from "../types/ethers-contracts/DepositManagerFactory";
import { RollupFactory } from "../types/ethers-contracts/RollupFactory";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { Signer, Contract } from "ethers";
import { DeploymentParameters } from "./interfaces";
import { allContracts } from "./allContractsInterfaces";
import {
    ClientFrontendFactory,
    SpokeRegistryFactory,
    VaultFactory,
    WithdrawManagerFactory
} from "../types/ethers-contracts";
import { State } from "./state";
import { merklise } from "./utils";

async function waitAndRegister(
    contract: Contract,
    name: string,
    verbose: boolean,
    nameRegistry?: NameRegistry,
    registryKey?: string
) {
    await contract.deployed();
    if (verbose) console.log("Deployed", name, "at", contract.address);
    if (nameRegistry) {
        if (!registryKey) throw Error(`Need registry key for ${name}`);
        const tx = await nameRegistry.registerName(
            registryKey,
            contract.address
        );
        await tx.wait();
        if (verbose) console.log("Registered", name, "on nameRegistry");
    }
}

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters,
    verbose: boolean = false
): Promise<allContracts> {
    // deploy libs

    const paramManager = await new ParamManagerFactory(signer).deploy();
    await waitAndRegister(paramManager, "paramManager", verbose);

    const clientFrondend = await new ClientFrontendFactory(signer).deploy();
    await waitAndRegister(clientFrondend, "clientFrondend", verbose);

    // deploy name registry
    const nameRegistry = await new NameRegistryFactory(signer).deploy();
    await waitAndRegister(nameRegistry, "nameRegistry", verbose);

    // deploy logger
    const logger = await new LoggerFactory(signer).deploy();
    await waitAndRegister(
        logger,
        "logger",
        verbose,
        nameRegistry,
        await paramManager.logger()
    );

    const allLinkRefs = {
        __$b941c30c0f5422d8b714f571f17d94a5fd$__: paramManager.address
    };

    const blsAccountRegistry = await new BlsAccountRegistryFactory(
        signer
    ).deploy(logger.address);
    await waitAndRegister(
        blsAccountRegistry,
        "blsAccountRegistry",
        verbose,
        nameRegistry,
        await paramManager.accountRegistry()
    );

    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistryFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await waitAndRegister(
        tokenRegistry,
        "tokenRegistry",
        verbose,
        nameRegistry,
        await paramManager.tokenRegistry()
    );

    const massMigration = await new MassMigrationFactory(signer).deploy();
    await waitAndRegister(
        massMigration,
        "mass_migs",
        verbose,
        nameRegistry,
        await paramManager.massMigration()
    );

    const transfer = await new TransferFactory(signer).deploy();
    await waitAndRegister(
        transfer,
        "transfer",
        verbose,
        nameRegistry,
        await paramManager.transferSimple()
    );

    // deploy POB contract
    const pob = await new PobFactory(signer).deploy();
    await waitAndRegister(
        pob,
        "pob",
        verbose,
        nameRegistry,
        await paramManager.proofOfBurn()
    );

    // deploy test token
    const testToken = await new TestTokenFactory(signer).deploy();
    await waitAndRegister(
        testToken,
        "testToken",
        verbose,
        nameRegistry,
        await paramManager.testToken()
    );
    await tokenRegistry.requestRegistration(testToken.address);
    await tokenRegistry.finaliseRegistration(testToken.address);

    const spokeRegistry = await new SpokeRegistryFactory(signer).deploy();
    await waitAndRegister(
        spokeRegistry,
        "spokeRegistry",
        verbose,
        nameRegistry,
        await paramManager.spokeRegistry()
    );

    const vault = await new VaultFactory(allLinkRefs, signer).deploy(
        nameRegistry.address
    );
    await waitAndRegister(
        vault,
        "vault",
        verbose,
        nameRegistry,
        await paramManager.vault()
    );

    // deploy deposit manager
    const depositManager = await new DepositManagerFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await waitAndRegister(
        depositManager,
        "depositManager",
        verbose,
        nameRegistry,
        await paramManager.depositManager()
    );

    const root =
        parameters.GENESIS_STATE_ROOT ||
        (await getMerkleRootWithCoordinatorAccount(parameters));

    // deploy Rollup core
    const rollup = await new RollupFactory(allLinkRefs, signer).deploy(
        nameRegistry.address,
        root
    );
    await waitAndRegister(
        rollup,
        "rollup",
        verbose,
        nameRegistry,
        await paramManager.rollupCore()
    );
    await vault.setRollupAddress();

    const withdrawManager = await new WithdrawManagerFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await waitAndRegister(
        withdrawManager,
        "withdrawManager",
        verbose,
        nameRegistry,
        await paramManager.withdrawManager()
    );
    await spokeRegistry.registerSpoke(withdrawManager.address);

    return {
        paramManager,
        clientFrondend,
        nameRegistry,
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

async function getMerkleRootWithCoordinatorAccount(
    parameters: DeploymentParameters
) {
    const state0 = State.new(0, 0, 0, 0);
    const state1 = State.new(1, 0, 0, 0);
    const dataLeaves = [state0.toStateLeaf(), state1.toStateLeaf()];
    const ZERO_BYTES32 =
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    for (let i = dataLeaves.length; i < 2 ** parameters.MAX_DEPTH; i++) {
        dataLeaves[i] = ZERO_BYTES32;
    }
    const result = await merklise(dataLeaves, parameters.MAX_DEPTH);
    return result;
}
