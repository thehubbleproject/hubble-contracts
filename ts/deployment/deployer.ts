import { Signer, utils } from "ethers";
import { Deployer, Deployer__factory } from "../../types/ethers-contracts";
import assert from "assert";
import { Provider } from "@ethersproject/providers";
import { DEPLOYER_ADDRESS, PROXY_CODE_HASH } from "./static";
import { logAddress, logDeployment, logTx } from "../../scripts/logger";

export interface DeploymentResult {
    address: string;
    alreadyDeployed: boolean;
}

export function calculateAddress(salt: string): string {
    return utils.getCreate2Address(DEPLOYER_ADDRESS, salt, PROXY_CODE_HASH);
}

export async function isDeployed(
    provider: Provider,
    salt: string
): Promise<boolean> {
    const address = calculateAddress(salt);
    const code = await provider.getCode(address);
    if (code == "0x") {
        return false;
    }
    return true;
}

export async function deploy(
    signer: Signer,
    salt: string,
    implementation: string,
    name: string,
    verbose: boolean
): Promise<DeploymentResult> {
    assert(signer.provider);
    const provider = signer.provider;

    const address = calculateAddress(salt);
    if (await isDeployed(provider, salt)) {
        logAddress(verbose, `${name} is ALREADY deployed`, address);
        return { address, alreadyDeployed: true };
    }
    const deployer = await getDeployer(signer);
    assert(deployer);
    const tx = await deployer.deploy(implementation, salt);

    logTx(verbose, `Tx: waiting, ${name} deployment tx`, tx.hash);
    await tx.wait();
    assert(await isDeployed(provider, salt));
    assert(address == (await deployer.calculateAddress(salt)));
    logDeployment(verbose, `Deployed: ${name}`, tx.hash, address);

    return { address, alreadyDeployed: false };
}

export async function isDeployerDeployed(provider: Provider): Promise<boolean> {
    const code = await provider.getCode(DEPLOYER_ADDRESS);
    if (code == "0x") {
        return false;
    }
    return true;
}

export async function getDeployer(
    signer: Signer
): Promise<Deployer | undefined> {
    assert(signer.provider);
    if (await isDeployerDeployed(signer.provider)) {
        let factory = new Deployer__factory(signer);
        return factory.attach(DEPLOYER_ADDRESS);
    }
}
