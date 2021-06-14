import { Pubkey } from "../../pubkey";
import { pubkeyDB } from "../../client/database/connection";
import { Leaf, getLeafKey } from "./Leaf";
import { solG2 } from "../../mcl";

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

    static fromSolG2(pubkey: solG2, itemId: number) {
        return new PubkeyLeaf(new Pubkey(pubkey), itemId);
    }

    // TODO Should this be static?
    deserialize(bytes: string): Pubkey {
        return Pubkey.fromEncoded(bytes);
    }
}
