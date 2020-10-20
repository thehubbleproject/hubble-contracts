import { State, StateSolStruct } from "./state";
import { TxTransfer, TxMassMigration, TxCreate2Transfer } from "./tx";
import { BigNumber } from "ethers";
interface SolStateMerkleProof {
    state: StateSolStruct;
    witness: string[];
}
interface ProofTransferTx {
    sender: StateSolStruct;
    receiver: StateSolStruct;
    senderWitness: string[];
    receiverWitness: string[];
    safe: boolean;
}
declare type ProofTransferBatch = ProofTransferTx[];
export declare function solProofFromTransfer(proof: ProofTransferTx): SolStateMerkleProof[];
export declare function solProofFromCreate2Transfer(proof: ProofTransferTx): SolStateMerkleProof[];
export declare class StateTree {
    static new(stateDepth: number): StateTree;
    private stateTree;
    private states;
    constructor(stateDepth: number);
    getStateWitness(stateID: number): string[];
    depth(): number;
    createState(state: State): void;
    createStateBulk(states: State[]): void;
    get root(): string;
    getState(stateID: number): State;
    applyTransferBatch(txs: TxTransfer[], feeReceiverID: number): {
        proof: ProofTransferBatch;
        feeProof: SolStateMerkleProof;
        solProofs: SolStateMerkleProof[];
        safe: boolean;
    };
    applyCreate2TransferBatch(txs: TxCreate2Transfer[], feeReceiverID: number): {
        proof: ProofTransferBatch;
        feeProof: SolStateMerkleProof;
        safe: boolean;
    };
    applyMassMigrationBatch(txs: TxMassMigration[], feeReceiverID: number): {
        proofs: SolStateMerkleProof[];
        safe: boolean;
    };
    applyFee(sumOfFee: BigNumber, feeReceiverID: number): {
        proof: SolStateMerkleProof;
        safe: boolean;
    };
    applyTxTransfer(tx: TxTransfer): ProofTransferTx;
    applyMassMigration(tx: TxMassMigration): {
        proof: SolStateMerkleProof;
        safe: boolean;
    };
    applyTxCreate2Transfer(tx: TxCreate2Transfer): ProofTransferTx;
}
export {};
