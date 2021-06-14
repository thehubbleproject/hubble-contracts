import { deployDeployer } from "./deployDeployer";
import { ContractFactory, Signer } from "ethers";
import assert from "assert";
import {
    calculateAddress,
    deploy as deployProxy,
    isDeployed as isProxyDeployed,
    DeploymentResult as ProxyDeploymentResult
} from "./deployer";
import {
    BNPairingPrecompileCostEstimator__factory,
    Proxy__factory
} from "../../types/ethers-contracts";
import { SALT } from "./static";
import { logAddress, logDeployment, logTx } from "../../scripts/logger";

export interface DeploymentResult extends ProxyDeploymentResult {
    implementation: string;
}

// 1. deploy deployer via keyless method
// 2. deploy other contracts with the deployer
export async function deployKeyless(
    signer: Signer,
    verbose: boolean,
    only?: { [key: string]: boolean }
) {
    // 1. ...
    await deployDeployer(signer, verbose);
    // 2. ...
    if (!only) {
        // deploy all
        await deployPairingGasEstimator(signer, verbose);
    } else {
        if (only["PairingGasEstimators"]) {
            await deployPairingGasEstimator(signer, verbose);
        }
    }
}

// deploys implementation and proxy
export async function deploy(
    implementationFactory: ContractFactory,
    salt: string,
    name: string,
    verbose: boolean
): Promise<DeploymentResult> {
    assert(implementationFactory.signer.provider);

    const provider = implementationFactory.signer.provider;
    const signer = implementationFactory.signer;

    if (await isProxyDeployed(provider, salt)) {
        const address = calculateAddress(salt);
        const proxyFactory = new Proxy__factory();
        const proxy = proxyFactory.attach(address).connect(provider);
        const implementation = await proxy.__implementation__();
        logAddress(verbose, `${name} is ALREADY deployed`, address);
        return { implementation, address, alreadyDeployed: true };
    }

    // Deploy implementation

    const implementation = await implementationFactory.deploy();

    logTx(
        verbose,
        `Tx: waiting, ${name} implementation deployment tx`,
        implementation.deployTransaction.hash
    );

    await implementation.deployed();

    logDeployment(
        verbose,
        `Deployed: ${name}`,
        implementation.deployTransaction.hash,
        implementation.address
    );

    // Deploy proxy

    const result = await deployProxy(
        signer,
        salt,
        implementation.address,
        name,
        verbose
    );
    const _result = result as DeploymentResult;
    _result.implementation = implementation.address;
    return _result;
}

export async function deployPairingGasEstimator(
    signer: Signer,
    verbose: boolean
) {
    assert(signer.provider);
    const factory = new BNPairingPrecompileCostEstimator__factory(signer);
    const result = await deploy(
        factory,
        SALT.PAIRING_GAS_ESTIMATOR,
        "PairingPrecompileCostEstimator",
        verbose
    );
    if (result.alreadyDeployed) {
        return;
    }
    const contract = factory.attach(result.address);
    // run cost estimator
    const tx = await contract.run();
    logTx(verbose, "Tx: waiting, PairingPrecompileCostEstimator:run", tx.hash);
    const receipt = await tx.wait();
    logTx(verbose, "Tx: PairingPrecompileCostEstimator:run", tx.hash);
}
