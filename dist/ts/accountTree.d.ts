import { Tree } from "./tree";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";
export declare class AccountRegistry {
    readonly registry: BlsAccountRegistry;
    private readonly depth;
    private readonly batchDepth;
    treeLeft: Tree;
    treeRight: Tree;
    leftIndex: number;
    rigthIndex: number;
    setSize: number;
    static new(registry: BlsAccountRegistry): Promise<AccountRegistry>;
    constructor(registry: BlsAccountRegistry, depth: number, batchDepth: number);
    register(pubkey: string[]): Promise<number>;
    witness(accountID: number): string[];
    root(): string;
    pubkeyToLeaf(uncompressed: string[]): string;
}
