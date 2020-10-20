import { BigNumberish, BytesLike, ethers } from "ethers";
import { Rollup } from "../types/ethers-contracts/Rollup";
interface CompressedStruct {
    stateRoot: BytesLike;
    bodyRoot: BytesLike;
}
interface SolStruct {
    stateRoot: BytesLike;
    body: any;
}
interface CommitmentInclusionProof {
    commitment: CompressedStruct;
    pathToCommitment: number;
    witness: string[];
}
interface XCommitmentInclusionProof {
    commitment: SolStruct;
    pathToCommitment: number;
    witness: string[];
}
declare abstract class Commitment {
    stateRoot: BytesLike;
    constructor(stateRoot: BytesLike);
    abstract get bodyRoot(): BytesLike;
    hash(): string;
    abstract toSolStruct(): SolStruct;
    abstract toBatch(): Batch;
    toCompressedStruct(): CompressedStruct;
}
export declare class TransferCommitment extends Commitment {
    stateRoot: BytesLike;
    accountRoot: BytesLike;
    signature: BigNumberish[];
    feeReceiver: BigNumberish;
    txs: BytesLike;
    static new(stateRoot?: BytesLike, accountRoot?: BytesLike, signature?: BigNumberish[], feeReceiver?: BigNumberish, txs?: BytesLike): TransferCommitment;
    constructor(stateRoot: BytesLike, accountRoot: BytesLike, signature: BigNumberish[], feeReceiver: BigNumberish, txs: BytesLike);
    get bodyRoot(): string;
    toSolStruct(): SolStruct;
    toBatch(): TransferBatch;
}
export declare class MassMigrationCommitment extends Commitment {
    stateRoot: BytesLike;
    accountRoot: BytesLike;
    signature: BigNumberish[];
    targetSpokeID: BigNumberish;
    withdrawRoot: BytesLike;
    tokenID: BigNumberish;
    amount: BigNumberish;
    feeReceiver: BigNumberish;
    txs: BytesLike;
    static new(stateRoot?: BytesLike, accountRoot?: BytesLike, signature?: BigNumberish[], targetSpokeID?: BigNumberish, withdrawRoot?: BytesLike, tokenID?: BigNumberish, amount?: BigNumberish, feeReceiver?: BigNumberish, txs?: BytesLike): MassMigrationCommitment;
    constructor(stateRoot: BytesLike, accountRoot: BytesLike, signature: BigNumberish[], targetSpokeID: BigNumberish, withdrawRoot: BytesLike, tokenID: BigNumberish, amount: BigNumberish, feeReceiver: BigNumberish, txs: BytesLike);
    get bodyRoot(): string;
    toSolStruct(): SolStruct;
    toBatch(): MassMigrationBatch;
}
export declare class Batch {
    readonly commitments: Commitment[];
    private tree;
    constructor(commitments: Commitment[]);
    get commitmentRoot(): string;
    witness(leafInfex: number): string[];
    proof(leafInfex: number): XCommitmentInclusionProof;
    proofCompressed(leafInfex: number): CommitmentInclusionProof;
}
export declare class TransferBatch extends Batch {
    readonly commitments: TransferCommitment[];
    constructor(commitments: TransferCommitment[]);
    submit(rollup: Rollup, stakingAmount: string): Promise<ethers.ContractTransaction>;
}
export declare class MassMigrationBatch extends Batch {
    readonly commitments: MassMigrationCommitment[];
    constructor(commitments: MassMigrationCommitment[]);
    submit(rollup: Rollup, stakingAmount: string): Promise<ethers.ContractTransaction>;
}
export {};
