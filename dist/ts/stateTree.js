"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateTree = exports.solProofFromCreate2Transfer = exports.solProofFromTransfer = void 0;
const tree_1 = require("./tree");
const state_1 = require("./state");
const ethers_1 = require("ethers");
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const STATE_WITNESS_LENGHT = 32;
const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(ethers_1.constants.HashZero);
const PLACEHOLDER_TRANSFER_PROOF = {
    sender: state_1.EMPTY_STATE,
    receiver: state_1.EMPTY_STATE,
    senderWitness: PLACEHOLDER_PROOF_WITNESS,
    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};
const PLACEHOLDER_SOL_STATE_PROOF = {
    state: state_1.EMPTY_STATE,
    witness: PLACEHOLDER_PROOF_WITNESS
};
function solProofFromTransfer(proof) {
    const { sender, senderWitness, receiver, receiverWitness } = proof;
    return [
        { state: sender, witness: senderWitness },
        { state: receiver, witness: receiverWitness }
    ];
}
exports.solProofFromTransfer = solProofFromTransfer;
function solProofFromCreate2Transfer(proof) {
    const { sender, senderWitness, receiver, receiverWitness } = proof;
    return [
        { state: sender, witness: senderWitness },
        { state: receiver, witness: receiverWitness }
    ];
}
exports.solProofFromCreate2Transfer = solProofFromCreate2Transfer;
class StateTree {
    constructor(stateDepth) {
        this.states = {};
        this.stateTree = tree_1.Tree.new(stateDepth, tree_1.Hasher.new("bytes", constants_1.ZERO_BYTES32));
    }
    static new(stateDepth) {
        return new StateTree(stateDepth);
    }
    getStateWitness(stateID) {
        return this.stateTree.witness(stateID).nodes;
    }
    depth() {
        return this.stateTree.depth;
    }
    createState(state) {
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
    createStateBulk(states) {
        for (const state of states) {
            this.createState(state);
        }
    }
    get root() {
        return this.stateTree.root;
    }
    getState(stateID) {
        return this.states[stateID];
    }
    applyTransferBatch(txs, feeReceiverID) {
        let safe = true;
        let proofs = [];
        let solProofs = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const proof = this.applyTxTransfer(txs[i]);
                proofs.push(proof);
                solProofs = solProofs.concat(solProofFromTransfer(proof));
                safe = proof.safe;
            }
            else {
                proofs.push(PLACEHOLDER_TRANSFER_PROOF);
            }
        }
        const sumOfFee = txs.map(tx => tx.fee).reduce((a, b) => a.add(b));
        const { proof: feeProof, safe: feeSafe } = this.applyFee(sumOfFee, feeReceiverID);
        solProofs.push(feeProof);
        safe = feeSafe;
        return { proof: proofs, feeProof, solProofs, safe };
    }
    applyCreate2TransferBatch(txs, feeReceiverID) {
        let safe = true;
        let proofs = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const proof = this.applyTxCreate2Transfer(txs[i]);
                proofs.push(proof);
                safe = proof.safe;
            }
            else {
                proofs.push(PLACEHOLDER_TRANSFER_PROOF);
            }
        }
        const sumOfFee = txs.map(tx => tx.fee).reduce((a, b) => a.add(b));
        const { proof: feeProof, safe: feeSafe } = this.applyFee(sumOfFee, feeReceiverID);
        safe = feeSafe;
        return { proof: proofs, feeProof, safe };
    }
    applyMassMigrationBatch(txs, feeReceiverID) {
        let safe = true;
        let proofs = [];
        for (const tx of txs) {
            if (safe) {
                const { proof, safe: txSafe } = this.applyMassMigration(tx);
                proofs.push(proof);
                safe = txSafe;
            }
            else {
                proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
            }
        }
        const sumOfFee = utils_1.sum(txs.map(tx => tx.fee));
        const { proof, safe: feeSafe } = this.applyFee(sumOfFee, feeReceiverID);
        safe = feeSafe;
        proofs.push(proof);
        return { proofs, safe };
    }
    applyFee(sumOfFee, feeReceiverID) {
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
        }
        else {
            return { proof: PLACEHOLDER_SOL_STATE_PROOF, safe: false };
        }
    }
    applyTxTransfer(tx) {
        const senderID = tx.fromIndex;
        const receiverID = tx.toIndex;
        const senderState = this.states[senderID];
        const receiverState = this.states[receiverID];
        const senderWitness = this.stateTree.witness(senderID).nodes;
        if (senderState && receiverState) {
            const senderStateStruct = senderState.toSolStruct();
            if (senderState.balance.lt(tx.amount.add(tx.fee)) ||
                senderState.tokenType != receiverState.tokenType) {
                return {
                    sender: senderStateStruct,
                    receiver: state_1.EMPTY_STATE,
                    senderWitness,
                    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
                    safe: false
                };
            }
            senderState.balance = senderState.balance.sub(tx.amount.add(tx.fee));
            senderState.nonce += 1;
            this.states[senderID] = senderState;
            this.stateTree.updateSingle(senderID, senderState.toStateLeaf());
            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            const receiverStateStruct = receiverState.toSolStruct();
            receiverState.balance = receiverState.balance.add(tx.amount);
            this.states[receiverID] = receiverState;
            this.stateTree.updateSingle(receiverID, receiverState.toStateLeaf());
            return {
                sender: senderStateStruct,
                senderWitness,
                receiver: receiverStateStruct,
                receiverWitness,
                safe: true
            };
        }
        else {
            if (!senderState) {
                return {
                    sender: state_1.EMPTY_STATE,
                    receiver: state_1.EMPTY_STATE,
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
                receiver: state_1.EMPTY_STATE,
                receiverWitness: receiverWitness,
                safe: false
            };
        }
    }
    applyMassMigration(tx) {
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
    applyTxCreate2Transfer(tx) {
        const senderID = tx.fromIndex;
        const receiverID = tx.toIndex;
        const senderState = this.states[senderID];
        const senderWitness = this.stateTree.witness(senderID).nodes;
        const senderStateStruct = senderState.toSolStruct();
        if (senderState.balance.lt(tx.amount.add(tx.fee))) {
            return {
                sender: senderStateStruct,
                receiver: state_1.EMPTY_STATE,
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
        const receiverState = state_1.State.new(tx.toAccID, senderState.tokenType, 0, 0);
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
exports.StateTree = StateTree;
//# sourceMappingURL=stateTree.js.map