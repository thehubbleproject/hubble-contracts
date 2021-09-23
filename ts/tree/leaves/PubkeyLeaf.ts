import { Pubkey } from "../../pubkey";
import { Leaf, getLeafKey, LeafFactoryFunc } from "./Leaf";
import { solG2 } from "../../mcl";
import { LevelUp } from "levelup";

const pubkeyName = "pubkeyLeaf";

export function PubkeyLeafFactory(pubkeyDB: LevelUp): LeafFactoryFunc<Pubkey> {
    const name = pubkeyName;

    const newLeaf = (item: Pubkey, itemID: number) => {
        return PubkeyLeaf.new(item, itemID, pubkeyDB);
    };

    const fromDB = async (itemId: number) => {
        return PubkeyLeaf.fromDB(itemId, pubkeyDB);
    };

    return { name, newLeaf, fromDB };
}

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = pubkeyName;

    static new(item: Pubkey, itemID: number, pubkeyDB: LevelUp): PubkeyLeaf {
        return new PubkeyLeaf(item, itemID, pubkeyDB);
    }

    static async fromDB(
        itemId: number,
        pubkeyDB: LevelUp
    ): Promise<PubkeyLeaf> {
        const key = getLeafKey(pubkeyName, itemId);
        const bytes = await pubkeyDB.get(key);
        const item = Pubkey.fromEncoded(bytes);
        return new PubkeyLeaf(item, itemId, pubkeyDB);
    }

    static fromSolG2(pubkey: solG2, itemId: number, pubkeyDB: LevelUp) {
        return new PubkeyLeaf(new Pubkey(pubkey), itemId, pubkeyDB);
    }
}
