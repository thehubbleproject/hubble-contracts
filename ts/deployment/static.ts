import { BigNumber, utils } from "ethers";
import {
    Proxy__factory,
    Deployer__factory
} from "../../types/ethers-contracts";
import { KeylessDeployer } from "./keylessDeployment";

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

export function calculateAddresses(): StaticAdresses {
    const deployer = new KeylessDeployer(deployerBytecode());

    const bnPairingCostEstimator = calculateAddress(
        deployer.contractAddress,
        SALT.PAIRING_GAS_ESTIMATOR
    );
    const addresses = {
        deployer: deployer.contractAddress,
        keyless: deployer.keylessAccount,
        bnPairingCostEstimator
    };
    return addresses;
}

function calculateAddress(deployerAddress: string, salt: string): string {
    return utils.getCreate2Address(deployerAddress, salt, PROXY_CODE_HASH);
}

export function proxyBytecode(): string {
    const proxyFactory = new Proxy__factory();
    return proxyFactory.bytecode;
}

export function deployerBytecode(): string {
    const deployerFactory = new Deployer__factory();
    return deployerFactory.bytecode;
}
