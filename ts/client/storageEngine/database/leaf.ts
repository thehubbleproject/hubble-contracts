import { db } from "./connection";
import { Hashable } from "../../../interfaces";
import { State } from "../../../state";
import { Pubkey } from "../../../pubkey";

abstract class Leaf<Item extends Hashable> {
    abstract readonly name: string;

    public item: Item;
    public itemID: number;

    constructor(public item: Item, public readonly itemID: number) {}

    static getKey(itemID: number, itemHash: string) {
        return `${this.name}${itemID}${itemHash}`;
    }

    static get key() {
        return this.getKey(this.itemID, this.item.hash());
    }

    abstract serialize(item: Item): string;

    abstract deserialize(bytes: string): this;

    static async fromDB(itemID: number, itemHash: string): Promise<Item> {
        const key = this.getKey(itemID, itemHash);
        const bytes = await db.get(key);
        const item = this.deserialize(bytes);
        return new this(item, itemID);
    }

    async toDB(): Promise<void> {
        const bytes = this.serialize(this.item);
        await db.put(this.key(), bytes);
    }

    async delete(): Promise<void> {
        await db.del(this.key());
    }
}

export class StateLeaf extends Leaf<State> {
    name = "";

    serialize(item: State): string {
        return "";
    }

    deserialize(bytes: string): this {
        return this;
    }
}

export class PubkeyLeaf extends Leaf<Pubkey> {
    name = "";

    serialize(item: Pubkey): string {
        return "";
    }

    deserialize(bytes: string): this {
        return this;
    }
}
