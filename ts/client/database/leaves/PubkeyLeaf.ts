import { Pubkey } from "../../../pubkey";
import { pubkeyDB } from "../connection";
import { Leaf } from "./Leaf";

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = "pubkeyLeaf";
    db = pubkeyDB;

    serialize() {
        return this.item.encode();
    }

    deserialize(bytes: string): Pubkey {
        return Pubkey.fromEncoded(bytes);
    }
}
