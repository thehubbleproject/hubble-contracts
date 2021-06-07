import { Pubkey } from "../../pubkey";
import { pubkeyDB } from "../../client/database/connection";
import { Leaf } from "./Leaf";

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = "pubkeyLeaf";
    db = pubkeyDB;

    deserialize(bytes: string): Pubkey {
        return Pubkey.fromEncoded(bytes);
    }
}
