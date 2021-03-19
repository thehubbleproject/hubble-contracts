import { Signer } from "ethers";
import assert from "assert";
import { KeylessDeployer } from "./keylessDeployment";
import {
    deployerBytecode,
    DEPLOYER_ADDRESS,
    KEYLESS_DEPLOYMENT
} from "./static";
import { logAddress, logDeployment } from "../../scripts/logger";

export async function deployDeployer(
    signer: Signer,
    verbose: boolean
): Promise<boolean> {
    assert(signer.provider);
    const provider = signer.provider;
    // Need exact GAS_PRICE and GAS_LIMIT to derive correct DEPLOYER_ADDRESS
    const deployer = new KeylessDeployer(
        deployerBytecode(),
        KEYLESS_DEPLOYMENT.GAS_PRICE,
        KEYLESS_DEPLOYMENT.GAS_LIMIT
    ).connect(provider);

    if (await deployer.alreadyDeployed()) {
        logAddress(
            verbose,
            "Deployer is ALREADY deployed",
            deployer.contractAddress
        );
        return true;
    }
    assert(DEPLOYER_ADDRESS == deployer.contractAddress);

    const receipt = await deployer.fundAndDeploy(signer);
    logDeployment(
        verbose,
        "Deployed: Deployer",
        receipt.transactionHash,
        deployer.contractAddress
    );
    return true;
}
