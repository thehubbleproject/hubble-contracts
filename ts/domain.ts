/**
 * Note: In a future version of ethers, this will
 * be promoted to stable (_ removed)
 *
 * _TypedDataEncoder -> TypedDataEncoder
 */
import { _TypedDataEncoder } from "ethers/lib/utils";
import { Rollup } from "../types/ethers-contracts/Rollup";

/**
 * Utilities for working with EIP-712 Domains
 * https://eips.ethereum.org/EIPS/eip-712
 * https://docs.ethers.io/v5/api/utils/hashing/#TypedDataEncoder
 */

export type DomainSeparator = string;

export type HubbleDomain = {
    name: string;
    version: string;
    chainId: number;
    // rollup
    verifyingContract: string;
};

/**
 * Hint: Use Rollup.domainSeparator() instead
 *
 * Gets the domainSeparator from a domain
 *
 * @param domain The hubble domain to use
 * @returns EIP-712 domainSeparator
 */
export const getDomainSeparator = (domain: HubbleDomain): DomainSeparator => {
    return _TypedDataEncoder.hashDomain(domain);
};

/**
 * Hint: Use Rollup.domainSeparator() instead
 *
 * Generates the domainSeparator from a Rollup contract
 *
 * @param rollup Rollup contract
 * @returns EIP-712 domainSeparator
 */
export const generateDomainSeparatorFromRollup = async (
    rollup: Rollup
): Promise<DomainSeparator> => {
    const [network, name, version] = await Promise.all([
        rollup.provider.getNetwork(),
        rollup.DOMAIN_NAME(),
        rollup.DOMAIN_VERSION()
    ]);

    return getDomainSeparator({
        name,
        version,
        chainId: network.chainId,
        verifyingContract: rollup.address
    });
};
