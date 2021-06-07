import { Hashable } from "../../interfaces";
import { LevelUp } from "levelup";

export abstract class Leaf<Item extends Hashable> {
    abstract readonly name: string;
    abstract db: LevelUp;

    public item: Item;
    public readonly itemID: number;

    constructor(item: Item, itemID: number) {
        this.item = item;
        this.itemID = itemID;
    }

    getKey(itemID: number, itemHash: string) {
        return `${this.name}${itemID}${itemHash}`;
    }

    get key() {
        return this.getKey(this.itemID, this.item.hash());
    }

    serialize(): string {
        return this.item.encode();
    }

    abstract deserialize(bytes: string): Item;

    async fromDB(itemID: number, itemHash: string) {
        const key = this.getKey(itemID, itemHash);
        const bytes = await this.db.get(key);
        const item = this.deserialize(bytes);
        return item;
    }

    async toDB(): Promise<void> {
        const bytes = this.serialize();
        await this.db.put(this.key, bytes);
    }

    async delete(): Promise<void> {
        await this.db.del(this.key);
    }
}
