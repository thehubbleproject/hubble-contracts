import { ZERO_BYTES32 } from "../../constants";
import { Hashable } from "../../interfaces";
import { Hasher, Tree } from "../../tree";
import { StorageEngine, WithWitness } from "./interfaces";

export interface Entry<Item> {
    itemID: number;
    item: Item;
}

export class MemoryEngine<Item extends Hashable>
    implements StorageEngine<Item> {
    public static new(depth: number) {
        return new this(depth);
    }
    private tree: Tree;
    private items: { [key: number]: Item } = {};
    private cache: { [key: number]: Item } = {};
    private journal: Entry<Item>[] = [];
    constructor(depth: number) {
        this.tree = Tree.new(depth, Hasher.new("bytes", ZERO_BYTES32));
    }
    private checkSize(itemID: number) {
        if (itemID >= this.tree.setSize)
            throw new Error(
                `Want itemID ${itemID} but the tree has only ${this.tree.setSize} leaves`
            );
    }

    public get root() {
        return this.tree.root;
    }

    public async get(itemID: number): Promise<Item> {
        this.checkSize(itemID);
        const item = this.cache[itemID] ?? this.items[itemID];
        if (!item) throw new Error(`Item not exists  itemID: ${itemID}`);
        return item;
    }

    public async getWithWitness(itemID: number): Promise<WithWitness<Item>> {
        const item = await this.get(itemID);
        const witness = this.tree.witness(itemID).nodes;
        return { item, witness };
    }

    public async update(itemID: number, item: Item) {
        this.checkSize(itemID);
        this.cache[itemID] = item;
        this.journal.push({ itemID, item });
    }
    private async trueUpdate(itemID: number, item: Item) {
        this.items[itemID] = item;
        this.tree.updateSingle(itemID, item.hash());
    }

    public async create(itemID: number, item: Item) {
        if (this.items[itemID])
            throw new Error(`Already exists  itemID: ${itemID}`);
        this.update(itemID, item);
    }

    public getCheckpoint(): number {
        return this.journal.length;
    }
    public revert(checkpoint: number = 0) {
        this.journal = this.journal.slice(0, checkpoint);
    }
    public async commit() {
        for (const entry of this.journal) {
            await this.trueUpdate(entry.itemID, entry.item);
        }
        this.journal = [];
        this.cache = {};
    }

    // These will be implemented in https://github.com/thehubbleproject/hubble-contracts/issues/570
    public async findVacantSubtree(
        subtreeDepth: number
    ): Promise<{ path: number; witness: string[] }> {
        throw new Error("Not implemented");
    }
    public async updateBatch(
        path: number,
        depth: number,
        items: Item[]
    ): Promise<void> {
        throw new Error("Not implemented");
    }
}
