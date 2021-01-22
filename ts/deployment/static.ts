import { BigNumber, utils } from "ethers";
import { ProxyFactory } from "../../types/ethers-contracts/ProxyFactory";
import { calculateDeployerAddress } from "./deployDeployer";
import { Provider } from "@ethersproject/providers";

export const PROXY_CODE_HASH = utils.keccak256(new ProxyFactory().bytecode);

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
    GAS_LIMIT: BigNumber.from(500000)
};

export const DEPLOYER_ADDRESS = "0x1C62Ce9284A462aA1BE23F5D9129fFC8d3e7a0bE";

export interface StaticAdresses {
    deployer: string;
    bnPairingCostEstimator: string;
}

export async function calculateAddresses(
    provider: Provider
): Promise<StaticAdresses> {
    const deployer = await calculateDeployerAddress(provider);
    const bnPairingCostEstimator = calculateAddress(
        deployer,
        SALT.PAIRING_GAS_ESTIMATOR
    );
    const addresses = {
        deployer,
        bnPairingCostEstimator
    };
    return addresses;
}

function calculateAddress(deployerAddress: string, salt: string): string {
    return utils.getCreate2Address(deployerAddress, salt, PROXY_CODE_HASH);
}
