import { Hasher, Node } from "./hasher";
import { JsArrayTree, Tree } from "./tree";

interface Entry {
    leafIndex: number;
    leaf: Node;
}

export class UndoableTree extends Tree {
    private hotTree: JsArrayTree;
    private journal: Entry[];
    constructor(depth: number, hasher: Hasher) {
        super(depth, hasher);
        this.hotTree = new JsArrayTree(this.depth);
        this.journal = [];
    }

    hotUpdateSingle(leafIndex: number, leaf: Node) {
        this.hotTree.update(this.depth, leafIndex, leaf);
        this.journal.push({ leafIndex, leaf });
    }

    hotGetNode(level: number, index: number): Node {
        return this.hotTree.get(level, index) || this.getNode(level, index);
    }

    get hotRoot() {
        return this.hotGetNode(0, 0);
    }

    reset() {
        this.hotTree = new JsArrayTree(this.depth);
        this.journal = [];
    }

    commit() {
        for (const entry of this.journal) {
            this.updateSingle(entry.leafIndex, entry.leaf);
        }
        this.reset();
    }
}
