import { Hashable } from "../../interfaces";
import { LevelUp } from "levelup";

export type LeafFactoryFunc<T extends Leaf<Hashable>> = (
    itemId: number,
    itemHash: string
) => Promise<T>;

export const getLeafKey = (
    name: string,
    itemID: number,
    itemHash: string
): string => `${name}${itemID}${itemHash}`;

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
        return getLeafKey(this.name, this.itemID, this.item.hash());
    }

    get key() {
        return this.getKey();
    }

    serialize(): string {
        return this.item.encode();
    }

    abstract deserialize(bytes: string): Item;

    async toDB(): Promise<void> {
        const bytes = this.serialize();
        await this.db.put(this.key, bytes);
    }

    async delete(): Promise<void> {
        await this.db.del(this.key);
    }
}
