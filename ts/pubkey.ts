import { solidityKeccak256 } from "ethers/lib/utils";
import { Hashable } from "./interfaces";
import { solG2 } from "./mcl";
import { prettyHex } from "./utils";

const solidityPubkeyType = ["uint256", "uint256", "uint256", "uint256"];

export const hashPubkey = (pubkey: solG2): string =>
    solidityKeccak256(solidityPubkeyType, pubkey);

/**
 * Public key with utility functions
 */
export class Pubkey implements Hashable {
    constructor(public readonly pubkey: solG2) {}

    public hash(): string {
        return hashPubkey(this.pubkey);
    }

    public toString(): string {
        const shortHexes = this.pubkey
            .map(s => prettyHex(s.toString()))
            .join(", ");
        return `<Pubkey  ${shortHexes}>`;
    }
}
