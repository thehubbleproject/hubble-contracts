import { Vacant } from "../../interfaces";

export interface WithWitness<Item> {
    item: Item;
    witness: string[];
}

export interface StorageEngine<Item> {
    get(itemID: number): Promise<Item>;
    update(itemID: number, item: Item): Promise<void>;
    create(itemID: number, item: Item): Promise<void>;
    getWithWitness(itemID: number): Promise<WithWitness<Item>>;
    getCheckpoint(): number;
    findVacantSubtree(subtreeDepth: number): Promise<Vacant>;
    updateBatch(path: number, depth: number, items: Item[]): Promise<void>;
    revert(checkpoint?: number): void;
    commit(): Promise<void>;
    root: string;
}
