import { Hasher, Node } from "./hasher";
export declare type Data = string;
export declare type Success = number;
export declare type Witness = {
    path: Array<boolean>;
    nodes: Array<Node>;
    leaf: Node;
    index: number;
    data?: Data;
    depth?: number;
};
export declare class Tree {
    readonly zeros: Array<Node>;
    readonly depth: number;
    readonly setSize: number;
    readonly hasher: Hasher;
    private readonly tree;
    static new(depth: number, hasher?: Hasher): Tree;
    static merklize(leaves: Node[]): Tree;
    constructor(depth: number, hasher: Hasher);
    get root(): Node;
    getNode(level: number, index: number): Node;
    witnessForBatch(mergeOffsetLower: number, subtreeDepth: number): Witness;
    witness(index: number, depth?: number): Witness;
    checkInclusion(witness: Witness): Success;
    insertSingle(leafIndex: number, data: Data): Success;
    updateSingle(leafIndex: number, leaf: Node): Success;
    insertBatch(offset: number, data: Array<Data>): Success;
    updateBatch(offset: number, data: Array<Node>): Success;
    isZero(level: number, leafIndex: number): boolean;
    private ascend;
    private updateCouple;
    private hashCouple;
    private getCouple;
}
