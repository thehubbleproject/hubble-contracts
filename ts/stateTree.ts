import { Hasher, Tree } from "./tree";
import { State, EMPTY_STATE, StateSolStruct } from "./state";
import { TxTransfer, TxMassMigration, TxCreate2Transfer } from "./tx";
import { BigNumber, constants } from "ethers";
import { ZERO_BYTES32 } from "./constants";
import { sum } from "./utils";
import {
    InsufficientFund,
    ReceiverNotExist,
    SenderNotExist,
    StateAlreadyExist,
    WrongTokenType
} from "./exceptions";

interface SolStateMerkleProof {
    state: StateSolStruct;
    witness: string[];
}

const STATE_WITNESS_LENGHT = 32;

const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(
    constants.HashZero
);

const PLACEHOLDER_SOL_STATE_PROOF: SolStateMerkleProof = {
    state: EMPTY_STATE,
    witness: PLACEHOLDER_PROOF_WITNESS
};

function applySender(sender: State, decrement: BigNumber): State {
    const state = sender.clone();
    state.balance = sender.balance.sub(decrement);
    state.nonce = sender.nonce + 1;
    return state;
}
function applyReceiver(receiver: State, increment: BigNumber): State {
    const state = receiver.clone();
    state.balance = receiver.balance.add(increment);
    return state;
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

    public getVacancyProof(mergeOffsetLower: number, subtreeDepth: number) {
        const witness = this.stateTree.witnessForBatch(
            mergeOffsetLower,
            subtreeDepth
        );
        const pathAtDepth = mergeOffsetLower >> subtreeDepth;

        return {
            witness: witness.nodes,
            depth: subtreeDepth,
            pathAtDepth
        };
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

    public processTransferCommit(
        txs: TxTransfer[],
        feeReceiverID: number
    ): {
        proofs: SolStateMerkleProof[];
        safe: boolean;
    } {
        let safe = true;
        let proofs: SolStateMerkleProof[] = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const {
                    proofs: transferProofs,
                    safe: transferSafe
                } = this.processTransfer(txs[i]);
                const [senderProof, receiverProof] = transferProofs;
                proofs.push(senderProof);
                proofs.push(receiverProof);
                safe = transferSafe;
            } else {
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
            }
        }
        const sumOfFee = sum(txs.map(tx => tx.fee));
        const { proof: feeProof, safe: feeSafe } = this.processReceiver(
            feeReceiverID,
            sumOfFee,
            proofs[0].state.tokenType
        );
        proofs.push(feeProof);
        safe = feeSafe;
        return { proofs, safe };
    }

    public processCreate2TransferCommit(
        txs: TxCreate2Transfer[],
        feeReceiverID: number
    ): {
        proofs: SolStateMerkleProof[];
        safe: boolean;
    } {
        let safe = true;
        let proofs: SolStateMerkleProof[] = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const {
                    proofs: transferProofs,
                    safe: transferSafe
                } = this.processCreate2Transfer(txs[i]);
                const [senderProof, receiverProof] = transferProofs;
                proofs.push(senderProof);
                proofs.push(receiverProof);
                safe = transferSafe;
            } else {
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
            }
        }
        const sumOfFee = sum(txs.map(tx => tx.fee));
        const { proof: feeProof, safe: feeSafe } = this.processReceiver(
            feeReceiverID,
            sumOfFee,
            proofs[0].state.tokenType
        );
        proofs.push(feeProof);
        safe = feeSafe;
        return { proofs, safe };
    }

    public processMassMigrationCommit(
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
                const { proof, safe: txSafe } = this.processMassMigration(tx);
                proofs.push(proof);
                safe = txSafe;
            } else {
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
            }
        }
        const sumOfFee = sum(txs.map(tx => tx.fee));
        const { proof, safe: feeSafe } = this.processReceiver(
            feeReceiverID,
            sumOfFee,
            proofs[0].state.tokenType
        );
        safe = feeSafe;
        proofs.push(proof);
        return { proofs, safe };
    }

    public processTransfer(
        tx: TxTransfer
    ): { proofs: SolStateMerkleProof[]; safe: boolean } {
        const decrement = tx.amount.add(tx.fee);
        const { proof: senderProof, safe: senderSafe } = this.processSender(
            tx.fromIndex,
            decrement
        );
        if (!senderSafe)
            return {
                proofs: [senderProof, PLACEHOLDER_SOL_STATE_PROOF],
                safe: false
            };
        const {
            proof: receiverProof,
            safe: receiverSafe
        } = this.processReceiver(
            tx.toIndex,
            tx.amount,
            senderProof.state.tokenType
        );
        return { proofs: [senderProof, receiverProof], safe: receiverSafe };
    }

    public processMassMigration(
        tx: TxMassMigration
    ): { proof: SolStateMerkleProof; safe: boolean } {
        return this.processSender(tx.fromIndex, tx.amount.add(tx.fee));
    }

    public processCreate2Transfer(
        tx: TxCreate2Transfer
    ): { proofs: SolStateMerkleProof[]; safe: boolean } {
        const decrement = tx.amount.add(tx.fee);
        const { proof: senderProof, safe: senderSafe } = this.processSender(
            tx.fromIndex,
            decrement
        );
        if (!senderSafe)
            return {
                proofs: [senderProof, PLACEHOLDER_SOL_STATE_PROOF],
                safe: false
            };
        const { proof: receiverProof, safe: receiverSafe } = this.processCreate(
            tx.toIndex,
            tx.toAccID,
            tx.amount,
            senderProof.state.tokenType
        );
        return { proofs: [senderProof, receiverProof], safe: receiverSafe };
    }

    private processSideEffects(
        stateIndex: number,
        postState: State
    ): SolStateMerkleProof {
        const state = this.states[stateIndex];
        const preStateStruct = state ? state.toSolStruct() : EMPTY_STATE;
        const witness = this.stateTree.witness(stateIndex).nodes;
        this.states[stateIndex] = postState;
        this.stateTree.updateSingle(stateIndex, postState.toStateLeaf());
        return { state: preStateStruct, witness };
    }
    public processSender(
        senderIndex: number,
        decrement: BigNumber
    ): SolStateMerkleProof {
        const state = this.states[senderIndex];
        if (!state) throw new SenderNotExist(`stateID: ${senderIndex}`);

        if (state.balance.lt(decrement))
            throw new InsufficientFund(
                `balance: ${state.balance}, tx amount+fee: ${decrement}`
            );
        const postState = applySender(state, decrement);
        const proof = this.processSideEffects(senderIndex, postState);
        return proof;
    }
    public processReceiver(
        receiverIndex: number,
        increment: BigNumber,
        tokenType: number
    ): SolStateMerkleProof {
        const state = this.states[receiverIndex];
        if (!state) throw new ReceiverNotExist(`stateID: ${receiverIndex}`);
        if (state.tokenType != tokenType)
            throw new WrongTokenType(
                `Tx tokenID: ${tokenType}, State tokenID: ${state.tokenType}`
            );
        const postState = applyReceiver(state, increment);
        const proof = this.processSideEffects(receiverIndex, postState);
        return proof;
    }

    public processCreate(
        createIndex: number,
        pubkeyIndex: number,
        balance: BigNumber,
        tokenType: number
    ): SolStateMerkleProof {
        if (this.states[createIndex] !== undefined)
            throw new StateAlreadyExist(`stateID: ${createIndex}`);
        const postState = State.new(pubkeyIndex, tokenType, balance, 0);
        const proof = this.processSideEffects(createIndex, postState);
        return proof;
    }
}
