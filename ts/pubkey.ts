import {
    BytesLike,
    solidityKeccak256,
    solidityPack,
    defaultAbiCoder
} from "ethers/lib/utils";
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

    public encode(): string {
        return solidityPack(solidityPubkeyType, this.pubkey);
    }

    static fromEncoded(data: BytesLike): Pubkey {
        const pubkeyDecoded = defaultAbiCoder.decode(solidityPubkeyType, data);

        const pubkeySolG2: solG2 = [
            pubkeyDecoded[0].toHexString(),
            pubkeyDecoded[1].toHexString(),
            pubkeyDecoded[2].toHexString(),
            pubkeyDecoded[3].toHexString()
        ];

        return new this(pubkeySolG2);
    }

    public toString(): string {
        const shortHexes = this.pubkey
            .map(s => prettyHex(s.toString()))
            .join(", ");
        return `<Pubkey  ${shortHexes}>`;
    }
}
