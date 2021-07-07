import { Hasher } from "./tree";
import { State, ZERO_STATE } from "./state";
import { TxTransfer, TxMassMigration, TxCreate2Transfer } from "./tx";
import { BigNumber, constants } from "ethers";
import { ZERO_BYTES32 } from "./constants";
import { minTreeDepth, sum } from "./utils";
import {
    ExceedStateTreeSize,
    InsufficientFund,
    ReceiverNotExist,
    SenderNotExist,
    StateAlreadyExist,
    WrongTokenID,
    ZeroAmount
} from "./exceptions";
import { Vacant } from "./interfaces";
import { MemoryTree } from "./tree/memoryTree";

export interface StateProvider {
    getState(stateID: number): Promise<SolStateMerkleProof>;
    createState(stateID: number, state: State): void;
    root: string;
}

class NullProvider implements StateProvider {
    getState(stateID: number): Promise<SolStateMerkleProof> {
        throw new Error(
            "This is a NullProvider, please connect to a real provider"
        );
    }
    createState(stateID: number, state: State) {
        throw new Error(
            "This is a NullProvider, please connect to a real provider"
        );
    }
    get root(): string {
        throw new Error(
            "This is a NullProvider, please connect to a real provider"
        );
    }
}
export const nullProvider = new NullProvider();

interface SolStateMerkleProof {
    state: State;
    witness: string[];
}

const STATE_WITNESS_LENGHT = 32;

const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(
    constants.HashZero
);

const PLACEHOLDER_SOL_STATE_PROOF: SolStateMerkleProof = {
    state: ZERO_STATE,
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
async function gen2array<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const x of gen) {
        out.push(x);
    }
    return out;
}

async function processNoRaise(
    generator: AsyncGenerator<SolStateMerkleProof>,
    expectedNumProofs: number
): Promise<{ proofs: SolStateMerkleProof[]; safe: boolean }> {
    let proofs: SolStateMerkleProof[] = [];
    let safe = true;
    for (let i = 0; i < expectedNumProofs; i++) {
        if (!safe) {
            proofs.push(PLACEHOLDER_SOL_STATE_PROOF);
            continue;
        }
        try {
            proofs.push((await generator.next()).value);
        } catch (error) {
            safe = false;
        }
    }
    return { proofs, safe };
}

export class StateTree implements StateProvider {
    public static new(stateDepth: number) {
        return new StateTree(stateDepth);
    }
    private stateTree: MemoryTree;
    private states: { [key: number]: State } = {};
    constructor(stateDepth: number) {
        this.stateTree = MemoryTree.new(
            stateDepth,
            Hasher.new("bytes", ZERO_BYTES32)
        );
    }
    private checkSize(stateID: number) {
        if (stateID >= this.stateTree.setSize)
            throw new ExceedStateTreeSize(
                `Want stateID ${stateID} but the tree has only ${this.stateTree.setSize} leaves`
            );
    }

    public async getState(stateID: number): Promise<SolStateMerkleProof> {
        this.checkSize(stateID);
        const state = this.states[stateID] || ZERO_STATE;
        const witness = (await this.stateTree.witness(stateID)).nodes;
        return { state, witness };
    }

    /** Side effect! */
    private async updateState(stateID: number, state: State) {
        this.checkSize(stateID);
        this.states[stateID] = state;
        await this.stateTree.updateSingle(stateID, state.toStateLeaf());
    }

    public async getVacancyProof(
        mergeOffsetLower: number,
        subtreeDepth: number
    ): Promise<Vacant> {
        const witness = await this.stateTree.witnessForBatch(
            mergeOffsetLower,
            subtreeDepth
        );
        const pathAtDepth = mergeOffsetLower >> subtreeDepth;

        return {
            witness: witness.nodes,
            pathAtDepth
        };
    }

    public depth() {
        return this.stateTree.depth;
    }

    public async createState(stateID: number, state: State) {
        if (this.states[stateID])
            throw new StateAlreadyExist(`stateID: ${stateID}`);
        await this.updateState(stateID, state);
    }
    public async createStateBulk(firstStateID: number, states: State[]) {
        for (const [i, state] of states.entries()) {
            await this.createState(firstStateID + i, state);
        }
        return this;
    }

    public get root() {
        return this.stateTree.root;
    }
    private async *_processTransferCommit(
        txs: TxTransfer[],
        feeReceiverID: number
    ): AsyncGenerator<SolStateMerkleProof> {
        const tokenID = this.states[txs[0].fromIndex].tokenID;
        for (const tx of txs) {
            const [senderProof, receiverProof] = await this.processTransfer(
                tx,
                tokenID
            );
            yield senderProof;
            yield receiverProof;
        }
        const proof = await this.processReceiver(
            feeReceiverID,
            sum(txs.map(tx => tx.fee)),
            tokenID
        );
        yield proof;
        return;
    }

    public async processTransferCommit(
        txs: TxTransfer[],
        feeReceiverID: number,
        raiseError: boolean = true
    ): Promise<{
        proofs: SolStateMerkleProof[];
        safe: boolean;
    }> {
        const generator = this._processTransferCommit(txs, feeReceiverID);
        if (raiseError) {
            return { proofs: await gen2array(generator), safe: true };
        } else {
            return processNoRaise(generator, txs.length * 2 + 1);
        }
    }
    private async *_processCreate2TransferCommit(
        txs: TxCreate2Transfer[],
        feeReceiverID: number
    ): AsyncGenerator<SolStateMerkleProof> {
        const tokenID = this.states[txs[0].fromIndex].tokenID;
        for (const tx of txs) {
            const [
                senderProof,
                receiverProof
            ] = await this.processCreate2Transfer(tx, tokenID);
            yield senderProof;
            yield receiverProof;
        }
        const proof = await this.processReceiver(
            feeReceiverID,
            sum(txs.map(tx => tx.fee)),
            tokenID
        );
        yield proof;
        return;
    }

    public async processCreate2TransferCommit(
        txs: TxCreate2Transfer[],
        feeReceiverID: number,
        raiseError: boolean = true
    ): Promise<{
        proofs: SolStateMerkleProof[];
        safe: boolean;
    }> {
        const generator = this._processCreate2TransferCommit(
            txs,
            feeReceiverID
        );
        if (raiseError) {
            return { proofs: await gen2array(generator), safe: true };
        } else {
            return await processNoRaise(generator, txs.length * 2 + 1);
        }
    }
    private async *_processMassMigrationCommit(
        txs: TxMassMigration[],
        feeReceiverID: number
    ): AsyncGenerator<SolStateMerkleProof> {
        const tokenID = this.states[txs[0].fromIndex].tokenID;
        for (const tx of txs) {
            const proof = this.processMassMigration(tx, tokenID);
            yield proof;
        }
        const proof = await this.processReceiver(
            feeReceiverID,
            sum(txs.map(tx => tx.fee)),
            tokenID
        );
        yield proof;
        return;
    }

    public async processMassMigrationCommit(
        txs: TxMassMigration[],
        feeReceiverID: number,
        raiseError: boolean = true
    ): Promise<{
        proofs: SolStateMerkleProof[];
        safe: boolean;
    }> {
        const generator = this._processMassMigrationCommit(txs, feeReceiverID);
        if (raiseError) {
            return { proofs: await gen2array(generator), safe: true };
        } else {
            return await processNoRaise(generator, txs.length + 1);
        }
    }

    public async processTransfer(
        tx: TxTransfer,
        tokenID: number
    ): Promise<SolStateMerkleProof[]> {
        const senderProof = await this.processSender(
            tx.fromIndex,
            tokenID,
            tx.amount,
            tx.fee
        );
        const receiverProof = await this.processReceiver(
            tx.toIndex,
            tx.amount,
            tokenID
        );
        return [senderProof, receiverProof];
    }

    public async processMassMigration(
        tx: TxMassMigration,
        tokenID: number
    ): Promise<SolStateMerkleProof> {
        return await this.processSender(
            tx.fromIndex,
            tokenID,
            tx.amount,
            tx.fee
        );
    }

    public async processCreate2Transfer(
        tx: TxCreate2Transfer,
        tokenID: number
    ): Promise<SolStateMerkleProof[]> {
        const senderProof = await this.processSender(
            tx.fromIndex,
            tokenID,
            tx.amount,
            tx.fee
        );
        const receiverProof = await this.processCreate(
            tx.toIndex,
            tx.toPubkeyID,
            tx.amount,
            tokenID
        );
        return [senderProof, receiverProof];
    }

    private async getProofAndUpdate(
        stateID: number,
        postState: State
    ): Promise<SolStateMerkleProof> {
        const proofBeforeUpdate = await this.getState(stateID);
        await this.updateState(stateID, postState);
        return proofBeforeUpdate;
    }
    public async processSender(
        senderIndex: number,
        tokenID: number,
        amount: BigNumber,
        fee: BigNumber
    ): Promise<SolStateMerkleProof> {
        const state = this.states[senderIndex];
        if (!state) throw new SenderNotExist(`stateID: ${senderIndex}`);
        if (amount.isZero()) throw new ZeroAmount();
        const decrement = amount.add(fee);
        if (state.balance.lt(decrement))
            throw new InsufficientFund(
                `balance: ${state.balance}, tx amount+fee: ${decrement}`
            );
        if (state.tokenID != tokenID)
            throw new WrongTokenID(
                `Tx tokenID: ${tokenID}, State tokenID: ${state.tokenID}`
            );

        const postState = applySender(state, decrement);
        const proof = await this.getProofAndUpdate(senderIndex, postState);
        return proof;
    }
    public async processReceiver(
        receiverIndex: number,
        increment: BigNumber,
        tokenID: number
    ): Promise<SolStateMerkleProof> {
        const state = this.states[receiverIndex];
        if (!state) throw new ReceiverNotExist(`stateID: ${receiverIndex}`);
        if (state.tokenID != tokenID)
            throw new WrongTokenID(
                `Tx tokenID: ${tokenID}, State tokenID: ${state.tokenID}`
            );
        const postState = applyReceiver(state, increment);
        const proof = await this.getProofAndUpdate(receiverIndex, postState);
        return proof;
    }

    public async processCreate(
        createIndex: number,
        pubkeyID: number,
        balance: BigNumber,
        tokenID: number
    ): Promise<SolStateMerkleProof> {
        if (this.states[createIndex] !== undefined)
            throw new StateAlreadyExist(`stateID: ${createIndex}`);
        const postState = State.new(pubkeyID, tokenID, balance, 0);
        const proof = await this.getProofAndUpdate(createIndex, postState);
        return proof;
    }
}

export class MigrationTree extends StateTree {
    public static async fromStates(states: State[]) {
        const depth = minTreeDepth(states.length);
        const migrationTree = new this(depth);
        return await migrationTree.createStateBulk(0, states);
    }

    public async getWithdrawProof(stateID: number) {
        const { state, witness } = await this.getState(stateID);
        return { state, witness, path: stateID };
    }
}
