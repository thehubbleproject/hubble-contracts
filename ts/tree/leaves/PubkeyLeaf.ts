import { Pubkey } from "../../pubkey";
import { pubkeyDB } from "../../client/database/connection";
import { Leaf } from "./Leaf";

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = "pubkeyLeaf";
    db = pubkeyDB;

    deserialize(bytes: string): Pubkey {
        return Pubkey.fromEncoded(bytes);
    }

    async fromDB(itemID: number, itemHash: string): Promise<PubkeyLeaf> {
        const key = this.getKey(itemID, itemHash);
        const bytes = await this.db.get(key);
        const item = this.deserialize(bytes);
        return new PubkeyLeaf(item, itemID);
    }
}
