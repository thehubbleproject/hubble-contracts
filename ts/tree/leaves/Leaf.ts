import { LevelUp } from "levelup";
import { Hashable } from "../../interfaces";

export type LeafFactoryFunc<Item extends Hashable> = {
    name: string;
    newLeaf(item: Item, itemID: number): Leaf<Item>;
    fromDB(itemId: number): Promise<Leaf<Item>>;
};

export const getLeafKey = (name: string, itemID: number): string =>
    `${name}${itemID}`;

export abstract class Leaf<Item extends Hashable> {
    abstract readonly name: string;
    abstract readonly db: LevelUp;

    public readonly item: Item;
    public readonly itemID: number;

    constructor(item: Item, itemID: number) {
        this.item = item;
        this.itemID = itemID;
    }

    getKey() {
        return getLeafKey(this.name, this.itemID);
    }

    get key() {
        return this.getKey();
    }

    serialize(): string {
        return this.item.encode();
    }

    async toDB(): Promise<void> {
        const bytes = this.serialize();
        await this.db.put(this.key, bytes);
    }

    async delete(): Promise<void> {
        await this.db.del(this.key);
    }
}
