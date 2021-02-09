import { BigNumber } from "ethers";
import { ZERO_BYTES32 } from "./constants";
import {
    ZeroAmount,
    InsufficientFund,
    WrongTokenID,
    ExceedStateTreeSize,
    StateAlreadyExist,
    StateNotExist
} from "./exceptions";
import { State } from "./state";
import { Tree, Hasher } from "./tree";
import { TxTransfer } from "./tx";
import { sum } from "./utils";

export interface StateAndWitness {
    state: State;
    witness: string[];
}

export interface StateEngine {
    get(stateID: number): Promise<State>;
    update(stateID: number, state: State): Promise<void>;
    create(stateID: number, state: State): Promise<void>;
    getWithWitness(stateID: number): Promise<StateAndWitness>;
    getCheckpoint(): number;
    revert(checkpoint?: number): void;
    commit(): Promise<void>;
    root: string;
}

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

async function processSender(
    senderID: number,
    tokenID: number,
    amount: BigNumber,
    fee: BigNumber,
    nonce: number,
    engine: StateEngine
): Promise<void> {
    const state = await engine.get(senderID);
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
    if (state.nonce != nonce) {
        throw new Error(`Bad nonce state: ${state.nonce}  tx: ${nonce}`);
    }

    const postState = applySender(state, decrement);
    await engine.update(senderID, postState);
}

async function processReceiver(
    receiverID: number,
    increment: BigNumber,
    tokenID: number,
    engine: StateEngine
): Promise<void> {
    const state = await engine.get(receiverID);
    if (state.tokenID != tokenID)
        throw new WrongTokenID(
            `Tx tokenID: ${tokenID}, State tokenID: ${state.tokenID}`
        );
    const postState = applyReceiver(state, increment);
    await engine.update(receiverID, postState);
}

async function processTransfer(
    tx: TxTransfer,
    tokenID: number,
    engine: StateEngine
): Promise<void> {
    await processSender(
        tx.fromIndex,
        tokenID,
        tx.amount,
        tx.fee,
        tx.nonce,
        engine
    );
    await processReceiver(tx.toIndex, tx.amount, tokenID, engine);
}

export async function processTransferCommit(
    txs: TxTransfer[],
    feeReceiverID: number,
    engine: StateEngine
): Promise<TxTransfer[]> {
    const tokenID = (await engine.get(feeReceiverID)).tokenID;
    let acceptedTxs = [];
    for (const tx of txs) {
        const checkpoint = engine.getCheckpoint();
        try {
            await processTransfer(tx, tokenID, engine);
            engine.commit();
            acceptedTxs.push(tx);
        } catch (err) {
            console.log("Drop tx due to ", err.message);
            engine.revert(checkpoint);
        }
    }
    const fees = sum(acceptedTxs.map(tx => tx.fee));
    await processReceiver(feeReceiverID, fees, tokenID, engine);
    return acceptedTxs;
}

export interface Entry {
    stateID: number;
    state: State;
}

export class MemEngine implements StateEngine {
    public static new(stateDepth: number) {
        return new this(stateDepth);
    }
    private tree: Tree;
    private states: { [key: number]: State } = {};
    private cache: { [key: number]: State } = {};
    private journal: Entry[] = [];
    constructor(stateDepth: number) {
        this.tree = Tree.new(stateDepth, Hasher.new("bytes", ZERO_BYTES32));
    }
    private checkSize(stateID: number) {
        if (stateID >= this.tree.setSize)
            throw new ExceedStateTreeSize(
                `Want stateID ${stateID} but the tree has only ${this.tree.setSize} leaves`
            );
    }

    public get root() {
        return this.tree.root;
    }

    public async get(stateID: number): Promise<State> {
        this.checkSize(stateID);
        const state = this.cache[stateID] ?? this.states[stateID];
        if (!state) throw new StateNotExist(`stateID: ${stateID}`);
        return state;
    }

    public async getWithWitness(stateID: number): Promise<StateAndWitness> {
        const state = await this.get(stateID);
        const witness = this.tree.witness(stateID).nodes;
        return { state, witness };
    }

    public async update(stateID: number, state: State) {
        this.checkSize(stateID);
        this.cache[stateID] = state;
        this.journal.push({ stateID, state });
    }
    private async trueUpdate(stateID: number, state: State) {
        this.states[stateID] = state;
        this.tree.updateSingle(stateID, state.toStateLeaf());
    }

    public async create(stateID: number, state: State) {
        if (this.states[stateID])
            throw new StateAlreadyExist(`stateID: ${stateID}`);
        this.update(stateID, state);
    }

    public getCheckpoint(): number {
        return this.journal.length;
    }
    public revert(checkpoint: number = 0) {
        this.journal = this.journal.slice(0, checkpoint);
    }
    public async commit() {
        for (const entry of this.journal) {
            await this.trueUpdate(entry.stateID, entry.state);
        }
        this.journal = [];
        this.cache = {};
    }
}
