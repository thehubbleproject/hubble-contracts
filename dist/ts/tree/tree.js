"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tree = void 0;
const constants_1 = require("../constants");
const hasher_1 = require("./hasher");
class Tree {
    constructor(depth, hasher) {
        this.tree = [];
        this.depth = depth;
        this.setSize = 2 ** this.depth;
        this.tree = [];
        for (let i = 0; i < depth + 1; i++) {
            this.tree.push({});
        }
        this.hasher = hasher;
        this.zeros = this.hasher.zeros(depth);
    }
    static new(depth, hasher) {
        return new Tree(depth, hasher || hasher_1.Hasher.new());
    }
    static merklize(leaves) {
        // Make the depth as shallow as possible
        // the length 1 is a special case that the formula doesn't work
        const depth = leaves.length == 1 ? 1 : Math.ceil(Math.log2(leaves.length));
        // This ZERO_BYTES32 must match the one we use in the mekle tree utils contract
        const hasher = hasher_1.Hasher.new("bytes", constants_1.ZERO_BYTES32);
        const tree = Tree.new(depth, hasher);
        tree.updateBatch(0, leaves);
        return tree;
    }
    get root() {
        return this.tree[0][0] || this.zeros[0];
    }
    getNode(level, index) {
        return this.tree[level][index] || this.zeros[level];
    }
    // witnessForBatch given merging subtree offset and depth constructs a witness
    witnessForBatch(mergeOffsetLower, subtreeDepth) {
        const mergeSize = 1 << subtreeDepth;
        const mergeOffsetUpper = mergeOffsetLower + mergeSize;
        const pathFollower = mergeOffsetLower >> subtreeDepth;
        if (mergeOffsetLower >> subtreeDepth !=
            (mergeOffsetUpper - 1) >> subtreeDepth) {
            throw new Error("bad merge alignment");
        }
        return this.witness(pathFollower, this.depth - subtreeDepth);
    }
    // witness given index and depth constructs a witness
    witness(index, depth = this.depth) {
        const path = Array(depth);
        const nodes = Array(depth);
        let nodeIndex = index;
        const leaf = this.getNode(depth, nodeIndex);
        for (let i = 0; i < depth; i++) {
            nodeIndex ^= 1;
            nodes[i] = this.getNode(depth - i, nodeIndex);
            path[i] = (nodeIndex & 1) == 1;
            nodeIndex >>= 1;
        }
        return { path, nodes, leaf, index, depth };
    }
    // checkInclusion verifies the given witness.
    // It performs root calculation rather than just looking up for the leaf or node
    checkInclusion(witness) {
        // we check the form of witness data rather than looking up for the leaf
        if (witness.nodes.length == 0)
            return -2;
        if (witness.nodes.length != witness.path.length)
            return -3;
        const data = witness.data;
        if (data) {
            if (witness.nodes.length != this.depth)
                return -4;
            if (this.hasher.hash(data) != witness.leaf)
                return -5;
        }
        let depth = witness.depth;
        if (!depth) {
            depth = this.depth;
        }
        let acc = witness.leaf;
        for (let i = 0; i < depth; i++) {
            const node = witness.nodes[i];
            if (witness.path[i]) {
                acc = this.hasher.hash2(acc, node);
            }
            else {
                acc = this.hasher.hash2(node, acc);
            }
        }
        return acc == this.root ? 0 : -1;
    }
    // insertSingle updates tree with a single raw data at given index
    insertSingle(leafIndex, data) {
        if (leafIndex >= this.setSize) {
            return -1;
        }
        this.tree[this.depth][leafIndex] = this.hasher.toLeaf(data);
        this.ascend(leafIndex, 1);
        return 0;
    }
    // updateSingle updates tree with a leaf at given index
    updateSingle(leafIndex, leaf) {
        if (leafIndex >= this.setSize) {
            return -1;
        }
        this.tree[this.depth][leafIndex] = leaf;
        this.ascend(leafIndex, 1);
        return 0;
    }
    // insertBatch given multiple raw data updates tree ascending from an offset
    insertBatch(offset, data) {
        const len = data.length;
        if (len == 0)
            return -1;
        if (len + offset > this.setSize)
            return -2;
        for (let i = 0; i < len; i++) {
            this.tree[this.depth][offset + i] = this.hasher.toLeaf(data[i]);
        }
        this.ascend(offset, len);
        return 0;
    }
    // updateBatch given multiple sequencial data updates tree ascending from an offset
    updateBatch(offset, data) {
        const len = data.length;
        if (len == 0)
            return -1;
        if (len + offset > this.setSize)
            return -2;
        for (let i = 0; i < len; i++) {
            this.tree[this.depth][offset + i] = data[i];
        }
        this.ascend(offset, len);
        return 0;
    }
    isZero(level, leafIndex) {
        return this.zeros[level] == this.getNode(level, leafIndex);
    }
    ascend(offset, len) {
        for (let level = this.depth; level > 0; level--) {
            if (offset & 1) {
                offset -= 1;
                len += 1;
            }
            if (len & 1) {
                len += 1;
            }
            for (let node = offset; node < offset + len; node += 2) {
                this.updateCouple(level, node);
            }
            offset >>= 1;
            len >>= 1;
        }
    }
    updateCouple(level, leafIndex) {
        const n = this.hashCouple(level, leafIndex);
        this.tree[level - 1][leafIndex >> 1] = n;
    }
    hashCouple(level, leafIndex) {
        const X = this.getCouple(level, leafIndex);
        return this.hasher.hash2(X.l, X.r);
    }
    getCouple(level, index) {
        index = index & ~1;
        return {
            l: this.getNode(level, index),
            r: this.getNode(level, index + 1)
        };
    }
}
exports.Tree = Tree;
//# sourceMappingURL=tree.js.map