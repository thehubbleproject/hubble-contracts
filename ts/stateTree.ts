import { Tree } from "./tree";
import { State, EMPTY_STATE, StateSolStruct } from "./state";
import { TxTransfer, TxMassMigration } from "./tx";
import { BigNumber } from "ethers";

interface ProofTransferTx {
    sender: StateSolStruct;
    receiver: StateSolStruct;
    senderWitness: string[];
    receiverWitness: string[];
    safe: boolean;
}
interface ProofTransferFee {
    feeReceiver: StateSolStruct;
    feeReceiverWitness: string[];
    safe: boolean;
}

type ProofTransferBatch = ProofTransferTx[];

interface ProofOfMassMigrationTx {
    state: StateSolStruct;
    witness: string[];
    safe: boolean;
}

const STATE_WITNESS_LENGHT = 32;
const ZERO =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(ZERO);
const PLACEHOLDER_TRANSFER_PROOF: ProofTransferTx = {
    sender: EMPTY_STATE,
    receiver: EMPTY_STATE,
    senderWitness: PLACEHOLDER_PROOF_WITNESS,
    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};

export class StateTree {
    public static new(stateDepth: number) {
        return new StateTree(stateDepth);
    }
    private stateTree: Tree;
    private states: { [key: number]: State } = {};
    constructor(stateDepth: number) {
        this.stateTree = Tree.new(stateDepth);
    }

    public getStateWitness(stateID: number) {
        return this.stateTree.witness(stateID).nodes;
    }

    public createState(state: State) {
        const stateID = state.stateID;
        if (this.states[stateID]) {
            throw new Error("state id is in use");
        }
        const leaf = state.toStateLeaf();
        this.stateTree.updateSingle(stateID, leaf);
        // Need to clone the object so that whatever we do on this.states later won't affect the input state.
        this.states[stateID] = state.clone();
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
        feeProof: ProofTransferFee;
        safe: boolean;
    } {
        let safe = true;
        let proofs: ProofTransferTx[] = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const proof = this.applyTxTransfer(txs[i]);
                proofs.push(proof);
                safe = proof.safe;
            } else {
                proofs.push(PLACEHOLDER_TRANSFER_PROOF);
            }
        }
        const sumOfFee = txs.map(tx => tx.fee).reduce((a, b) => a.add(b));
        const feeProof = this.applyFee(sumOfFee, feeReceiverID);
        safe = feeProof.safe;
        return { proof: proofs, feeProof, safe };
    }

    public applyFee(
        sumOfFee: BigNumber,
        feeReceiverID: number
    ): ProofTransferFee {
        const state = this.states[feeReceiverID];

        if (state) {
            const stateStruct = state.toSolStruct();
            const witness = this.stateTree.witness(feeReceiverID).nodes;
            state.balance = state.balance.add(sumOfFee);
            this.states[feeReceiverID] = state;
            this.stateTree.updateSingle(feeReceiverID, state.toStateLeaf());
            return {
                feeReceiver: stateStruct,
                feeReceiverWitness: witness,
                safe: true
            };
        } else {
            return {
                feeReceiver: EMPTY_STATE,
                feeReceiverWitness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
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

    public applyMassMigration(tx: TxMassMigration): ProofOfMassMigrationTx {
        const senderID = tx.fromIndex;
        if (tx.toIndex != 0) {
            return {
                state: EMPTY_STATE,
                witness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
        }
        const senderState = this.states[senderID];
        const senderWitness = this.stateTree.witness(senderID).nodes;
        const senderStateStruct = senderState.toSolStruct();
        if (senderState.balance.lt(tx.amount)) {
            return {
                state: EMPTY_STATE,
                witness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
        }
        senderState.balance = senderState.balance.sub(tx.amount);
        senderState.nonce += 1;
        this.states[senderID] = senderState;
        this.stateTree.updateSingle(senderID, senderState.toStateLeaf());
        return {
            state: senderStateStruct,
            witness: senderWitness,
            safe: true
        };
    }
}
