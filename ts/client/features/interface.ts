import { TransactionDescription } from "@ethersproject/abi";
import { BytesLike } from "ethers";
import { StorageManager } from "../storageEngine";

export interface CompressedStruct {
    stateRoot: BytesLike;
    bodyRoot: BytesLike;
}
export interface SolStruct {
    stateRoot: BytesLike;
    body: any;
}

export interface CommitmentInclusionProof {
    commitment: CompressedStruct;
    path: number;
    witness: string[];
}

export interface XCommitmentInclusionProof {
    commitment: SolStruct;
    path: number;
    witness: string[];
}

export interface StateMachine {
    apply(
        commitment: Commitment,
        storageManager: StorageManager
    ): Promise<void>;
}

export interface Commitment {
    bodyRoot: BytesLike;
    toSolStruct(): SolStruct;
    toCompressedStruct(): CompressedStruct;
}

export interface Batch {
    commitments: Commitment[];
}

export interface BatchMeta {
    accountRoot: string;
}

export interface Feature {
    parseBatch(
        txDescription: TransactionDescription,
        batchMeta: BatchMeta
    ): Batch;
    getStateMachine(): StateMachine;
}
