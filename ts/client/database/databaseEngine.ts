import { ZERO_BYTES32 } from "../../constants";
import { TreeAtLevelIsFull } from "../../exceptions";
import { Hashable, Vacant } from "../../interfaces";
import { Hasher } from "../../tree";
import { DBTree } from "../../tree/dbTree";
import { LeafFactoryFunc } from "../../tree/leaves/Leaf";
import { StorageEngine, WithWitness } from "../storageEngine/interfaces";

export class DatabaseEngine<Item extends Hashable>
    implements StorageEngine<Item> {
    private tree: DBTree;
    public readonly leafFactory: LeafFactoryFunc<Item>;

    constructor(depth: number, factory: LeafFactoryFunc<Item>) {
        this.tree = DBTree.new(
            depth,
            factory.name,
            Hasher.new("bytes", ZERO_BYTES32)
        );
        this.leafFactory = factory;
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
        return (await this.leafFactory.fromDB(itemID)).item;
    }

    public async getWithWitness(itemID: number): Promise<WithWitness<Item>> {
        const item = await this.get(itemID);
        const witness = (await this.tree.witness(itemID)).nodes;
        return { item, witness };
    }

    public async update(itemID: number, item: Item) {
        this.checkSize(itemID);
        await this.trueUpdate(itemID, item);
    }

    private async trueUpdate(itemID: number, item: Item) {
        await this.leafFactory.newLeaf(item, itemID).toDB();
        await this.tree.updateSingle(itemID, item.hash());
    }

    public async create(itemID: number, item: Item) {
        const itemFound = await this.get(itemID);
        if (itemFound) throw new Error(`Already exists  itemID: ${itemID}`);
        await this.update(itemID, item);
    }

    public getCheckpoint(): number {
        return 0;
    }

    public revert(checkpoint: number = 0) {
        // no-op
    }

    public async commit() {
        // no-op
    }

    public async findVacantSubtree(subtreeDepth: number): Promise<Vacant> {
        const level = this.tree.depth - subtreeDepth;
        const zero = this.tree.zeros[level];
        for (let i = 0; i < 2 ** level; i++) {
            // Check tree for entry at that level
            if ((await this.tree.getNode(level, i)) !== zero) {
                continue;
            }

            const witness = (await this.tree.witness(i, level)).nodes;
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
