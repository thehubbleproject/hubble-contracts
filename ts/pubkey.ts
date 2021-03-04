import { solidityKeccak256 } from "ethers/lib/utils";
import { Hashable } from "./interfaces";
import { solG2 } from "./mcl";

export class Pubkey implements Hashable {
    constructor(public readonly pubkey: solG2) {}
    hash() {
        return solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            this.pubkey
        );
    }
}
