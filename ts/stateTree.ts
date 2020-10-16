import { Hasher, Tree } from "./tree";
import { State, EMPTY_STATE, StateSolStruct } from "./state";
import { TxTransfer, TxMassMigration, TxCreate2Transfer } from "./tx";
import { BigNumber, constants } from "ethers";
import { ZERO_BYTES32 } from "./constants";
import { sum } from "./utils";

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

type ProofTransferBatch = ProofTransferTx[];

const STATE_WITNESS_LENGHT = 32;

const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(
    constants.HashZero
);

const PLACEHOLDER_TRANSFER_PROOF: ProofTransferTx = {
    sender: EMPTY_STATE,
    receiver: EMPTY_STATE,
    senderWitness: PLACEHOLDER_PROOF_WITNESS,
    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};

const PLACEHOLDER_SOL_STATE_PROOF: SolStateMerkleProof = {
    state: EMPTY_STATE,
    witness: PLACEHOLDER_PROOF_WITNESS
};

export function solProofFromTransfer(
    proof: ProofTransferTx
): SolStateMerkleProof[] {
    const { sender, senderWitness, receiver, receiverWitness } = proof;
    return [
        { state: sender, witness: senderWitness },
        { state: receiver, witness: receiverWitness }
    ];
}

export function solProofFromCreate2Transfer(
    proof: ProofTransferTx
): SolStateMerkleProof[] {
    const { sender, senderWitness, receiver, receiverWitness } = proof;
    return [
        { state: sender, witness: senderWitness },
        { state: receiver, witness: receiverWitness }
    ];
}

export class StateTree {
    public static new(stateDepth: number) {
        return new StateTree(stateDepth);
    }
    private stateTree: Tree;
    private states: { [key: number]: State } = {};
    constructor(stateDepth: number) {
        this.stateTree = Tree.new(
            stateDepth,
            Hasher.new("bytes", ZERO_BYTES32)
        );
    }

    public getStateWitness(stateID: number) {
        return this.stateTree.witness(stateID).nodes;
    }

    public depth() {
        return this.stateTree.depth;
    }

    public createState(state: State) {
        const stateID = state.stateID;
        if (this.states[stateID]) {
            throw new Error("state id is in use");
        }
        this.states[stateID] = state.clone();
        this.states[stateID].setStateID(state.stateID);
        this.states[stateID].setPubkey(state.publicKey);
        const leaf = state.toStateLeaf();
        this.stateTree.updateSingle(stateID, leaf);
    }
    public createStateBulk(states: State[]) {
        for (const state of states) {
            this.createState(state);
        }
    }

    public get root() {
        return this.stateTree.root;
    }
    public getState(stateID: number) {
        return this.states[stateID];
    }

    public applyTransferBatch(
        txs: TxTransfer[],
        feeReceiverID: number
    ): {
        proof: ProofTransferBatch;
        feeProof: SolStateMerkleProof;
        solProofs: SolStateMerkleProof[];
        safe: boolean;
    } {
        let safe = true;
        let proofs: ProofTransferTx[] = [];
        let solProofs: SolStateMerkleProof[] = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const proof = this.applyTxTransfer(txs[i]);
                proofs.push(proof);
                solProofs = solProofs.concat(solProofFromTransfer(proof));
                safe = proof.safe;
            } else {
                proofs.push(PLACEHOLDER_TRANSFER_PROOF);
            }
        }
        const sumOfFee = txs.map(tx => tx.fee).reduce((a, b) => a.add(b));
        const { proof: feeProof, safe: feeSafe } = this.applyFee(
            sumOfFee,
            feeReceiverID
        );
        solProofs.push(feeProof);
        safe = feeSafe;
        return { proof: proofs, feeProof, solProofs, safe };
    }

    public applyCreate2TransferBatch(
        txs: TxCreate2Transfer[],
        feeReceiverID: number
    ): {
        proof: ProofTransferBatch;
        feeProof: SolStateMerkleProof;
        safe: boolean;
    } {
        let safe = true;
        let proofs: ProofTransferTx[] = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const proof = this.applyTxCreate2Transfer(txs[i]);
                proofs.push(proof);
                safe = proof.safe;
            } else {
                proofs.push(PLACEHOLDER_TRANSFER_PROOF);
            }
        }
        const sumOfFee = txs.map(tx => tx.fee).reduce((a, b) => a.add(b));
        const { proof: feeProof, safe: feeSafe } = this.applyFee(
            sumOfFee,
            feeReceiverID
        );
        safe = feeSafe;
        return { proof: proofs, feeProof, safe };
    }

    public applyMassMigrationBatch(
        txs: TxMassMigration[],
        feeReceiverID: number
    ): {
        proofs: SolStateMerkleProof[];
        safe: boolean;
    } {
        let safe = true;
        let proofs: SolStateMerkleProof[] = [];
        for (const tx of txs) {
            if (safe) {
                const { proof, safe: txSafe } = this.applyMassMigration(tx);
                proofs.push(proof);
                safe = txSafe;
            } else {
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
            }
        }
        const sumOfFee = sum(txs.map(tx => tx.fee));
        const { proof, safe: feeSafe } = this.applyFee(sumOfFee, feeReceiverID);
        safe = feeSafe;
        proofs.push(proof);
        return { proofs, safe };
    }

    public applyFee(
        sumOfFee: BigNumber,
        feeReceiverID: number
    ): { proof: SolStateMerkleProof; safe: boolean } {
        const state = this.states[feeReceiverID];

        if (state) {
            const stateStruct = state.toSolStruct();
            const witness = this.stateTree.witness(feeReceiverID).nodes;
            state.balance = state.balance.add(sumOfFee);
            this.states[feeReceiverID] = state;
            this.stateTree.updateSingle(feeReceiverID, state.toStateLeaf());
            return {
                proof: { state: stateStruct, witness: witness },
                safe: true
            };
        } else {
            return { proof: PLACEHOLDER_SOL_STATE_PROOF, safe: false };
        }
    }

    public applyTxTransfer(tx: TxTransfer): ProofTransferTx {
        const senderID = tx.fromIndex;
        const receiverID = tx.toIndex;

        const senderState = this.states[senderID];
        const receiverState = this.states[receiverID];

        const senderWitness = this.stateTree.witness(senderID).nodes;
        if (senderState && receiverState) {
            const senderStateStruct = senderState.toSolStruct();
            if (
                senderState.balance.lt(tx.amount.add(tx.fee)) ||
                senderState.tokenType != receiverState.tokenType
            ) {
                return {
                    sender: senderStateStruct,
                    receiver: EMPTY_STATE,
                    senderWitness,
                    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
                    safe: false
                };
            }

            senderState.balance = senderState.balance.sub(
                tx.amount.add(tx.fee)
            );
            senderState.nonce += 1;
            this.states[senderID] = senderState;
            this.stateTree.updateSingle(senderID, senderState.toStateLeaf());

            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            const receiverStateStruct = receiverState.toSolStruct();
            receiverState.balance = receiverState.balance.add(tx.amount);
            this.states[receiverID] = receiverState;
            this.stateTree.updateSingle(
                receiverID,
                receiverState.toStateLeaf()
            );

            return {
                sender: senderStateStruct,
                senderWitness,
                receiver: receiverStateStruct,
                receiverWitness,
                safe: true
            };
        } else {
            if (!senderState) {
                return {
                    sender: EMPTY_STATE,
                    receiver: EMPTY_STATE,
                    senderWitness,
                    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
                    safe: false
                };
            }
            const senderStateStruct = senderState.toSolStruct();
            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            return {
                sender: senderStateStruct,
                senderWitness,
                receiver: EMPTY_STATE,
                receiverWitness: receiverWitness,
                safe: false
            };
        }
    }

    public applyMassMigration(
        tx: TxMassMigration
    ): { proof: SolStateMerkleProof; safe: boolean } {
        const senderID = tx.fromIndex;
        const senderState = this.states[senderID];
        const senderWitness = this.stateTree.witness(senderID).nodes;
        const senderStateStruct = senderState.toSolStruct();
        if (senderState.balance.lt(tx.amount.add(tx.fee))) {
            return { proof: PLACEHOLDER_SOL_STATE_PROOF, safe: false };
        }
        senderState.balance = senderState.balance.sub(tx.amount.add(tx.fee));
        senderState.nonce += 1;
        this.states[senderID] = senderState;
        this.stateTree.updateSingle(senderID, senderState.toStateLeaf());
        return {
            proof: { state: senderStateStruct, witness: senderWitness },
            safe: true
        };
    }

    public applyTxCreate2Transfer(tx: TxCreate2Transfer): ProofTransferTx {
        const senderID = tx.fromIndex;
        const receiverID = tx.toIndex;
        const senderState = this.states[senderID];
        const senderWitness = this.stateTree.witness(senderID).nodes;
        const senderStateStruct = senderState.toSolStruct();
        if (senderState.balance.lt(tx.amount.add(tx.fee))) {
            return {
                sender: senderStateStruct,
                receiver: EMPTY_STATE,
                senderWitness,
                receiverWitness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
        }

        // update sender

        //balance
        senderState.balance = senderState.balance.sub(tx.amount.add(tx.fee));
        // nonce
        senderState.nonce += 1;

        // update state
        this.states[senderID] = senderState;
        this.stateTree.updateSingle(senderID, senderState.toStateLeaf());

        // create receiver account
        const receiverState = State.new(
            tx.toAccID,
            senderState.tokenType,
            0,
            0
        );

        receiverState.balance = receiverState.balance.add(tx.amount);
        receiverState.stateID = tx.toIndex;
        const receiverStateStruct = receiverState.toSolStruct();
        this.createState(receiverState);

        const receiverWitness = this.stateTree.witness(receiverID).nodes;
        return {
            sender: senderStateStruct,
            senderWitness,
            receiver: receiverStateStruct,
            receiverWitness,
            safe: true
        };
    }
}
