export declare type Node = string;
export declare class Hasher {
    private leafType;
    private zero;
    static new(leafType?: string, zero?: string): Hasher;
    constructor(leafType?: string, zero?: string);
    toLeaf(data: string): string;
    hash(x0: string): string;
    hash2(x0: string, x1: string): string;
    zeros(depth: number): Array<Node>;
}
