import { solidityKeccak256 } from "ethers/lib/utils";
import { Hashable } from "./interfaces";
import { solG2 } from "./mcl";
import { prettyHex } from "./utils";

export class Pubkey implements Hashable {
    constructor(public readonly pubkey: solG2) {}
    hash() {
        return solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            this.pubkey
        );
    }
    toString(): string {
        const shortHexes = this.pubkey
            .map(s => prettyHex(s.toString()))
            .join(", ");
        return `<Pubkey  ${shortHexes}>`;
    }
}
