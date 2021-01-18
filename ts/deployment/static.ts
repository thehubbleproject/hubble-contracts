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
    GAS_LIMIT: BigNumber.from(383544)
};

export const DEPLOYER_ADDRESS = "0xc8dc24aF494c7417A5039429Bb04575a6Ed32E09";

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
