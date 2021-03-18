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
    const deployer = new KeylessDeployer(deployerBytecode()).connect(provider);

    if (await deployer.alreadyDeployed()) {
        logAddress(
            verbose,
            "Deployer is ALREADY deployed",
            deployer.contractAddress
        );
        return true;
    }
    assert(KEYLESS_DEPLOYMENT.GAS_LIMIT.gte(await deployer.estimateGas()));
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
