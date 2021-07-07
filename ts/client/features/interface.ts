import { BigNumber, BytesLike, ContractTransaction, Event } from "ethers";
import { SignatureInterface } from "../../blsSigner";

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
    fromIndex: BigNumber;
    serialize(): string;
    message(nonce: BigNumber): string;
    toString(): string;
}

export interface OffchainTx extends CompressedTx {
    toCompressed(): CompressedTx;
    message(): string;
    fee: BigNumber;
    nonce: BigNumber;
    signature?: SignatureInterface;
    hash(): string;
}

export interface FailedOffchainTxWrapper {
    tx: OffchainTx;
    err: Error;
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
    commitmentRoot: string;
    proofCompressed(leafIndex: number): CommitmentInclusionProof;
    toString(): string;
}

export interface BatchHandlingStrategy {
    parseBatch(event: Event): Promise<Batch>;
    processBatch(batch: Batch): Promise<OffchainTx[]>;
}

export interface BatchPackingCommand {
    packAndSubmit(): Promise<ContractTransaction>;
}
