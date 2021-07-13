import {
    BadMergeAlignment,
    EmptyArray,
    ExceedTreeSize,
    MismatchHash,
    MismatchLength,
    NegativeIndex
} from "../exceptions";
import { Hasher, Node } from "./hasher";
import { ItemNode } from "./leaves/Node";
import { AsyncTree, Data, Witness } from "./tree";

export class DBTree implements AsyncTree {
    public readonly zeros: Array<Node>;
    public readonly depth: number;
    public readonly setSize: number;
    public readonly hasher: Hasher;
    public readonly nodeType: string;
    public _root: Node;

    public static new(depth: number, nodeType: string, hasher?: Hasher) {
        return new DBTree(depth, nodeType, hasher || Hasher.new());
    }

    constructor(depth: number, nodeType: string, hasher: Hasher) {
        this.depth = depth;
        this.hasher = hasher;
        this.zeros = this.hasher.zeros(depth);
        this.setSize = 2 ** this.depth;
        this.nodeType = nodeType;
        this._root = this.zeros[0];
    }

    get root(): Node {
        return this._root;
    }

    public async getNode(level: number, index: number): Promise<Node> {
        try {
            return await ItemNode.fromDB(this.nodeType, level, index);
        } catch (error) {
            if (error.name === "NotFoundError") {
                return this.zeros[level];
            } else {
                throw error;
            }
        }
    }

    public async witnessForBatch(
        mergeOffsetLower: number,
        subtreeDepth: number
    ): Promise<Witness> {
        const mergeSize = 2 ** subtreeDepth;
        const mergeOffsetUpper = mergeOffsetLower + mergeSize;
        const pathFollower = mergeOffsetLower >> subtreeDepth;
        const subtreeRootIndexUpper = (mergeOffsetUpper - 1) >> subtreeDepth;

        if (pathFollower != subtreeRootIndexUpper)
            throw new BadMergeAlignment(
                `pathFollower ${pathFollower}; subtreeRootIndexUpper ${subtreeRootIndexUpper}`
            );

        return await this.witness(pathFollower, this.depth - subtreeDepth);
    }

    public async witness(
        index: number,
        depth: number = this.depth
    ): Promise<Witness> {
        const path = Array<boolean>(depth);
        const nodes = Array<Node>(depth);
        let nodeIndex = index;
        const leaf = await this.getNode(depth, nodeIndex);
        for (let i = 0; i < depth; i++) {
            nodeIndex ^= 1;
            nodes[i] = await this.getNode(depth - i, nodeIndex);
            path[i] = (nodeIndex & 1) == 1;
            nodeIndex >>= 1;
        }
        return { path, nodes, leaf, index, depth };
    }

    public async checkInclusion(witness: Witness): Promise<boolean> {
        // we check the form of witness data rather than looking up for the leaf
        if (witness.nodes.length == 0) throw new EmptyArray();
        if (witness.nodes.length != witness.path.length)
            throw new MismatchLength(
                `nodes: ${witness.nodes.length}; path: ${witness.path.length}`
            );
        const data = witness.data;
        if (data) {
            if (witness.nodes.length != this.depth)
                throw new MismatchLength(
                    `nodes: ${witness.nodes.length}; tree depth: ${this.depth}`
                );
            const dataHash = this.hasher.hash(data);
            if (dataHash != witness.leaf)
                throw new MismatchHash(
                    `hash(data): ${dataHash}; leaf: ${witness.leaf}`
                );
        }
        const depth = witness.depth ? witness.depth : this.depth;

        let leaf = witness.leaf;
        for (let i = 0; i < depth; i++) {
            const node = witness.nodes[i];
            if (witness.path[i]) {
                leaf = this.hasher.hash2(leaf, node);
            } else {
                leaf = this.hasher.hash2(node, leaf);
            }
        }
        return leaf === this.root;
    }

    public async insertSingle(leafIndex: number, data: Data) {
        this.checkSetSize(leafIndex);
        await ItemNode.toDB(
            this.nodeType,
            this.depth,
            leafIndex,
            this.hasher.toLeaf(data)
        );
        await this.ascend(leafIndex, 1);
    }

    public async updateSingle(leafIndex: number, leaf: Node) {
        this.checkSetSize(leafIndex);
        await ItemNode.toDB(this.nodeType, this.depth, leafIndex, leaf);
        await this.ascend(leafIndex, 1);
    }

    public async insertBatch(offset: number, data: Array<Data>) {
        const len = data.length;
        if (len == 0) throw new EmptyArray();
        const lastIndex = len + offset - 1;
        this.checkSetSize(lastIndex);
        for (let i = 0; i < len; i++) {
            await ItemNode.toDB(
                this.nodeType,
                this.depth,
                offset + 1,
                this.hasher.toLeaf(data[i])
            );
        }
        await this.ascend(offset, len);
    }

    public async updateBatch(offset: number, leaves: Array<Node>) {
        const len = leaves.length;
        if (len == 0) throw new EmptyArray();
        const lastIndex = len + offset - 1;
        this.checkSetSize(lastIndex);
        for (let i = 0; i < len; i++) {
            await ItemNode.toDB(
                this.nodeType,
                this.depth,
                offset + 1,
                leaves[i]
            );
        }
        await this.ascend(offset, len);
    }

    public async isZero(level: number, leafIndex: number): Promise<boolean> {
        return this.zeros[level] === (await this.getNode(level, leafIndex));
    }

    private checkSetSize(index: number) {
        if (index >= this.setSize)
            throw new ExceedTreeSize(
                `Leaf index ${index}; tree size ${this.setSize}`
            );
        // Probably an overflow if this error is hit
        if (index < 0) throw new NegativeIndex(`${index}`);
    }

    private async updateRoot() {
        this._root = await this.getNode(0, 0);
    }

    private async ascend(offset: number, len: number) {
        for (let level = this.depth; level > 0; level--) {
            if (offset & 1) {
                offset -= 1;
                len += 1;
            }
            if (len & 1) {
                len += 1;
            }
            for (let node = offset; node < offset + len; node += 2) {
                await this.updateCouple(level, node);
            }
            offset >>= 1;
            len >>= 1;
        }

        await this.updateRoot();
    }

    private async updateCouple(level: number, leafIndex: number) {
        const n = await this.hashCouple(level, leafIndex);
        await ItemNode.toDB(this.nodeType, level - 1, leafIndex >> 1, n);
    }

    private async hashCouple(level: number, leafIndex: number) {
        const X = await this.getCouple(level, leafIndex);
        return this.hasher.hash2(X.l, X.r);
    }

    private async getCouple(
        level: number,
        index: number
    ): Promise<{ l: Node; r: Node }> {
        index = index & ~1;
        return {
            l: await this.getNode(level, index),
            r: await this.getNode(level, index + 1)
        };
    }
}
