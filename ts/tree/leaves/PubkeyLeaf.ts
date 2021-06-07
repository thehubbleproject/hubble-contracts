import { Pubkey } from "../../pubkey";
import { pubkeyDB } from "../../client/database/connection";
import { Leaf, LeafFactory } from "./Leaf";
import { LevelUp } from "levelup";

export class PubkeyLeafFactory implements LeafFactory<PubkeyLeaf> {
    constructor(private readonly database: LevelUp) {}

    async create(itemId: number, itemHash: string): Promise<PubkeyLeaf> {
        const key = `pubkeyLeaf${itemId}${itemHash}`;
        const bytes = await this.database.get(key);
        const item = Pubkey.fromEncoded(bytes);
        return new PubkeyLeaf(item, itemId);
    }
}

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
