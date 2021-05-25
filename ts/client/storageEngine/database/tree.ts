import { ethers } from "hardhat";
import { db } from "./connection";

class Children {
    constructor(public readonly left: string, public readonly right: string) {}

    get parent() {
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256"],
            [this.left, this.right]
        );
    }

    static async fromDB(parent: string) {
        const children = await db.get(parent);
        // In js 1 byte = 2 characters. But we assume we operate on bytes here.
        const left = children.slice(0, 32);
        const right = children.slice(32, 64);
        return new this(left, right);
    }
    async toDB() {
        await db.put(this.parent, this.left + this.right);
    }
    async delete(): Promise<void> {
        await db.del(this.parent);
    }
}

class Tree<T> {
    constructor(public root: string, public readonly depth: number) {}
    async get(index: number) {
        const witness = [];
        let parent = this.root;
        let mask = 1 << this.depth;
        // find children from a parent
        // descend from root
        for (let i = 0; i < this.depth; i++) {
            const children = Children.fromParent(parent);
            const nextParentIsLeft = index & (mask === 0);
            parent = nextParentIsLeft ? children.left : children.right;
            const sibling = nextParentIsLeft ? children.right : children.left;
            mask >>= 1;
            witness.push(sibling);
        }
        const leaf = Leaf.fromDB(index, parent);
        witness.reverse();
        return { witness, leaf };
    }

    async update(index: number, leaf: Leaf<T>, witness?: string[]) {
        // If we already have witness, we can save 1 get
        const _witness = witness ?? (await this.get(index)).witness;
        let parent = leaf.item.hash();
        // parent = self + sibling or sibling + self
        // ascend to root
        for (let i = 0; i < this.depth; i++) {
            const sibling = witness[i];
            const children =
                (index >> i) & (1 == 0)
                    ? new Children(parent, sibling)
                    : new Children(sibling, parent);
            parent = children.parent;
        }
        this.root = parent;
        await leaf.toDB();
    }
    // TODO: define batch operation
}
