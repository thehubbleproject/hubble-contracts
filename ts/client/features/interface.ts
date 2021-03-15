import { TransactionDescription } from "@ethersproject/abi";
import { BigNumber, BytesLike, Event } from "ethers";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { SignatureInterface } from "../../blsSigner";
import { DeploymentParameters } from "../../interfaces";
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
    signature?: SignatureInterface;
}

export interface ProtocolParams {
    maxTxPerCommitment: number;
}

export interface StateMachine {
    validate(
        commitment: Commitment,
        storageManager: StorageManager
    ): Promise<void>;
}

export interface Commitment {
    stateRoot: BytesLike;
    bodyRoot: BytesLike;
    hash(): string;
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
    getStateMachine(params: ProtocolParams): StateMachine;
}

export interface BatchHandlingStrategy {
    parseBatch(event: Event): Promise<Batch>;
    processBatch(batch: Batch): Promise<void>;
}

export interface BatchPackingCommand {
    packAndSubmit(): Promise<void>;
}
