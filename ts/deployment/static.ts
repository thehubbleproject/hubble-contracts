import { BigNumber, utils } from "ethers";
import { calculateDeployerAddress } from "./deployDeployer";
import { Provider } from "@ethersproject/providers";
import { ProxyFactory } from "../../types/ethers-contracts/ProxyFactory";
import { DeployerFactory } from "../../types/ethers-contracts/DeployerFactory";

export const PROXY_BYTECODE = proxyBytecode();
export const PROXY_CODE_HASH = utils.keccak256(PROXY_BYTECODE);

export const SALT = {
    PAIRING_GAS_ESTIMATOR: utils.keccak256(
        utils.toUtf8Bytes(
            "HUBBLE_DEPLOYMENT_SALT" + ":" + "PAIRING_GAS_ESTIMATOR"
        )
    )
};

export const KEYLESS_DEPLOYMENT = {
    // Caution:
    // Gas price in mainnet is wildly volatile
    GAS_PRICE: BigNumber.from(10e10),
    GAS_LIMIT: BigNumber.from(383544)
};

export const DEPLOYER_ADDRESS = "0xD06b90B066e0041f4dD471C6DA85099742a9C98E";

export interface StaticAdresses {
    keyless: string;
    deployer: string;
    bnPairingCostEstimator: string;
}

export async function calculateAddresses(
    provider?: Provider
): Promise<StaticAdresses> {
    const deployerResult = await calculateDeployerAddress(provider);
    const deployer = deployerResult.deployerAddress;
    const keyless = deployerResult.keylessAccount;
    const bnPairingCostEstimator = calculateAddress(
        deployer,
        SALT.PAIRING_GAS_ESTIMATOR
    );
    const addresses = {
        keyless,
        deployer,
        bnPairingCostEstimator
    };
    return addresses;
}

function calculateAddress(deployerAddress: string, salt: string): string {
    return utils.getCreate2Address(deployerAddress, salt, PROXY_CODE_HASH);
}

export function proxyBytecode(): string {
    const proxyFactory = new ProxyFactory();
    return proxyFactory.bytecode;
}

export function deployerBytecode(): string {
    const deployerFactory = new DeployerFactory();
    return deployerFactory.bytecode;
}
