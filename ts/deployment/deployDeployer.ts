import { Signer } from "ethers";
import { DeployerFactory } from "../../types/ethers-contracts/DeployerFactory";
import { BigNumber } from "ethers";
import assert from "assert";
import { keylessDeploy, calculateKeylessDeployment } from "./keylessDeployment";
import { Provider } from "@ethersproject/providers";
import { DEPLOYER_ADDRESS, KEYLESS_DEPLOYMENT } from "./static";
import { logDeployment } from "../../scripts/logger";

export async function calculateDeployerAddress(
    provider: Provider
): Promise<string> {
    let result = await calculateKeylessDeployment(
        provider,
        bytecode(),
        KEYLESS_DEPLOYMENT.GAS_PRICE,
        KEYLESS_DEPLOYMENT.GAS_LIMIT,
        false
    );
    return result.contractAddress;
}

export async function calculateGasLimit(
    provider: Provider
): Promise<BigNumber> {
    let result = await calculateKeylessDeployment(
        provider,
        bytecode(),
        KEYLESS_DEPLOYMENT.GAS_PRICE,
        KEYLESS_DEPLOYMENT.GAS_LIMIT,
        false
    );
    return result.estimatedGasCost;
}

export async function deployDeployer(
    signer: Signer,
    verbose: boolean
): Promise<boolean> {
    assert(signer.provider);
    const provider = signer.provider;
    const result = await calculateKeylessDeployment(
        provider,
        bytecode(),
        KEYLESS_DEPLOYMENT.GAS_PRICE,
        KEYLESS_DEPLOYMENT.GAS_LIMIT,
        verbose
    );
    if (result.alreadyDeployed) {
        return true;
    }
    if (!KEYLESS_DEPLOYMENT.GAS_LIMIT.gte(result.estimatedGasCost)) throw Error(`gas issue ${KEYLESS_DEPLOYMENT.GAS_LIMIT} ${result.estimatedGasCost}`)
    if (DEPLOYER_ADDRESS != result.contractAddress) throw Error(`Address issue: expect ${DEPLOYER_ADDRESS} actual ${result.contractAddress}`)
    const _result = await keylessDeploy(
        signer,
        bytecode(),
        KEYLESS_DEPLOYMENT.GAS_PRICE,
        KEYLESS_DEPLOYMENT.GAS_LIMIT,
        verbose
    );
    logDeployment(
        verbose,
        "Deployed: Deployer",
        _result.receipt.transactionHash,
        _result.contractAddress
    );
    return true;
}

function bytecode(): string {
    const deployerFactory = new DeployerFactory();
    return deployerFactory.bytecode;
}
