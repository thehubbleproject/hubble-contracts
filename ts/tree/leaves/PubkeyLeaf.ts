import { Pubkey } from "../../pubkey";
import { pubkeyDB } from "../../client/database/connection";
import { Leaf, getLeafKey } from "./Leaf";

const pubkeyName = "pubkeyLeaf";

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = pubkeyName;
    db = pubkeyDB;

    static async fromDB(itemId: number, itemHash: string): Promise<PubkeyLeaf> {
        const key = getLeafKey(pubkeyName, itemId, itemHash);
        const bytes = await pubkeyDB.get(key);
        const item = Pubkey.fromEncoded(bytes);
        return new PubkeyLeaf(item, itemId);
    }

    // TODO Should this be static?
    deserialize(bytes: string): Pubkey {
        return Pubkey.fromEncoded(bytes);
    }
}
