import { Hashable } from "../interfaces";
import { Hasher } from "./hasher";
import { Leaf, LeafFactoryFunc } from "./leaves/Leaf";
import { MemoryTree } from "./memoryTree";

export class DBTree<LeafType extends Leaf<Hashable>> extends MemoryTree {
    private readonly leafFactory: LeafFactoryFunc<LeafType>;

    constructor(
        depth: number,
        leafFactory: LeafFactoryFunc<LeafType>,
        hasher?: Hasher
    ) {
        super(depth, hasher || Hasher.new());
        this.leafFactory = leafFactory;
    }
}
