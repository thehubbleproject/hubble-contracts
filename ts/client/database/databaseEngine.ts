import { Hashable } from "../../interfaces";
import { Leaf, LeafFactoryFunc } from "../../tree/leaves/Leaf";
import { MemoryEngine } from "../storageEngine/memoryEngine";

export class DatabaseEngine<Item extends Hashable> extends MemoryEngine<Item> {
    private readonly factory: LeafFactoryFunc<Leaf<Item>>;

    constructor(depth: number, factory: LeafFactoryFunc<Leaf<Item>>) {
        super(depth);
        this.factory = factory;
    }
}
