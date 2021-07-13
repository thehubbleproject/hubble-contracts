import { Pubkey } from "../../pubkey";
import { pubkeyDB } from "../../client/database/connection";
import { Leaf, getLeafKey, LeafFactoryFunc } from "./Leaf";
import { solG2 } from "../../mcl";

const pubkeyName = "pubkeyLeaf";

export function PubkeyLeafFactory(): LeafFactoryFunc<Pubkey> {
    const name = pubkeyName;

    const newLeaf = (item: Pubkey, itemID: number) => {
        return PubkeyLeaf.new(item, itemID);
    };

    const fromDB = async (itemId: number) => {
        return PubkeyLeaf.fromDB(itemId);
    };

    return { name, newLeaf, fromDB };
}

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = pubkeyName;
    db = pubkeyDB;

    static new(item: Pubkey, itemID: number): PubkeyLeaf {
        return new PubkeyLeaf(item, itemID);
    }

    static async fromDB(itemId: number): Promise<PubkeyLeaf> {
        const key = getLeafKey(pubkeyName, itemId);
        const bytes = await pubkeyDB.get(key);
        const item = Pubkey.fromEncoded(bytes);
        return new PubkeyLeaf(item, itemId);
    }

    static fromSolG2(pubkey: solG2, itemId: number) {
        return new PubkeyLeaf(new Pubkey(pubkey), itemId);
    }
}
