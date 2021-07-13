import { ZERO_BYTES32 } from "../../constants";
import { TreeAtLevelIsFull } from "../../exceptions";
import { Hashable, Vacant } from "../../interfaces";
import { Hasher } from "../../tree";
import { MemoryTree } from "../../tree/memoryTree";
import { StorageEngine, WithWitness, Entry } from "./interfaces";

export class MemoryEngine<Item extends Hashable>
    implements StorageEngine<Item> {
    public static new(depth: number) {
        return new this(depth);
    }
    private tree: MemoryTree;
    private items: { [key: number]: Item } = {};
    private cache: { [key: number]: Item } = {};
    private journal: Entry<Item>[] = [];
    constructor(depth: number) {
        this.tree = MemoryTree.new(depth, Hasher.new("bytes", ZERO_BYTES32));
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

    public async findVacantSubtree(subtreeDepth: number): Promise<Vacant> {
        const level = this.tree.depth - subtreeDepth;
        const zero = this.tree.zeros[level];
        for (let i = 0; i < 2 ** level; i++) {
            // Check tree for entry at that level
            if (this.tree.getNode(level, i) !== zero) {
                continue;
            }

            // Check cache for items.
            let itemCachedForSubtree = false;
            for (let k = 0; k < 2 ** subtreeDepth; k++) {
                const itemID = i * 2 ** subtreeDepth + k;
                if (this.cache[itemID]) {
                    itemCachedForSubtree = true;
                    break;
                }
            }
            if (itemCachedForSubtree) {
                continue;
            }

            const witness = this.tree.witness(i, level).nodes;
            return {
                pathAtDepth: i,
                witness
            };
        }
        throw new TreeAtLevelIsFull(
            `Tree at level ${level} is full, no room for subtree insert`
        );
    }
    public async updateBatch(
        path: number,
        depth: number,
        items: Item[]
    ): Promise<void> {
        for (const [i, item] of items.entries()) {
            const itemID = path * 2 ** depth + i;
            await this.update(itemID, item);
        }
    }
}
