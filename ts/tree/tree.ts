import { Hashable } from "../interfaces";
import { Hasher, Node } from "./hasher";

export type Data = string;

export type Level = { [node: number]: Node };

export type Witness = {
    path: Array<boolean>;
    nodes: Array<Node>;
    leaf: Node;
    index: number;
    data?: Data;
    depth?: number;
};

export interface Tree {
    zeros: Array<Node>;
    depth: number;
    setSize: number;
    hasher: Hasher;
    root: Node;
    getNode(level: number, index: number): Node;
    witnessForBatch(mergeOffsetLower: number, subtreeDepth: number): Witness;
    witness(index: number, depth?: number): Witness;
    checkInclusion(witness: Witness): boolean;
    insertSingle(leafIndex: number, data: Data): void;
    updateSingle(leafIndex: number, leaf: Node): void;
    insertBatch(offset: number, data: Array<Data>): void;
    updateBatch(offset: number, leaves: Array<Node>): void;
    isZero(level: number, leafIndex: number): boolean;
}

export interface AsyncTree {
    zeros: Array<Node>;
    depth: number;
    setSize: number;
    hasher: Hasher;
    root: Node;
    getNode(level: number, index: number): Promise<Node>;
    witnessForBatch(
        mergeOffsetLower: number,
        subtreeDepth: number
    ): Promise<Witness>;
    witness(index: number, depth?: number): Promise<Witness>;
    checkInclusion(witness: Witness): Promise<boolean>;
    insertSingle(leafIndex: number, data: Data): void;
    updateSingle(leafIndex: number, leaf: Node): void;
    insertBatch(offset: number, data: Array<Data>): void;
    updateBatch(offset: number, leaves: Array<Node>): void;
    isZero(level: number, leafIndex: number): Promise<boolean>;
}
