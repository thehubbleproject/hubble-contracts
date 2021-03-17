import { Signer } from "ethers";
import { BigNumber } from "ethers";
import assert from "assert";
import { keylessDeploy, calculateKeylessDeployment } from "./keylessDeployment";
import { Provider } from "@ethersproject/providers";
import {
    deployerBytecode,
    DEPLOYER_ADDRESS,
    KEYLESS_DEPLOYMENT
} from "./static";
import { logAddress, logDeployment } from "../../scripts/logger";
import { isDeployerDeployed } from "./deployer";

export async function calculateDeployerAddress(
    provider?: Provider
): Promise<{ deployerAddress: string; keylessAccount: string }> {
    let result = await calculateKeylessDeployment(
        undefined,
        deployerBytecode(),
        KEYLESS_DEPLOYMENT.GAS_PRICE,
        KEYLESS_DEPLOYMENT.GAS_LIMIT,
        false
    );
    return {
        deployerAddress: result.contractAddress,
        keylessAccount: result.keylessAccount
    };
}

export async function calculateGasLimit(
    provider: Provider
): Promise<BigNumber> {
    let result = await calculateKeylessDeployment(
        provider,
        deployerBytecode(),
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
    if (await isDeployerDeployed(signer.provider)) {
        logAddress(verbose, "Deployer is ALREADY deployed", DEPLOYER_ADDRESS);
        return true;
    }
    const _result = await keylessDeploy(
        signer,
        deployerBytecode(),
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
