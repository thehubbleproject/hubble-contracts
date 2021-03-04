import { TransactionDescription } from "@ethersproject/abi";
import { BigNumber, BytesLike } from "ethers";
import { SignatureInterface } from "../../blsSigner";
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

export const StateIDLen = 4;
export const FloatLength = 2;

export interface CompressedTx {
    txType: string;
    serialize(): string;
    message(nonce: number): string;
}

export interface OffchainTx extends CompressedTx {
    txType: string;
    toCompressed(): CompressedTx;
    message(): string;
    fee: BigNumber;
    nonce: number;
    signature: SignatureInterface;
}

export interface StateMachine {
    validate(
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
