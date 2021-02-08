import { BigNumber } from "ethers";
import { ZERO_BYTES32 } from "./constants";
import {
    ZeroAmount,
    InsufficientFund,
    WrongTokenID,
    ExceedStateTreeSize,
    StateNotExist,
    StateAlreadyExist
} from "./exceptions";
import { State } from "./state";
import { SolStateMerkleProof } from "./stateTree";
import { Tree, Hasher } from "./tree";
import { TxTransfer } from "./tx";
import { sum } from "./utils";

export interface StateEngine {
    getNoWitness(stateID: number): Promise<State>;
    get(stateID: number): Promise<SolStateMerkleProof>;
    update(stateID: number, state: State): Promise<void>;
    create(stateID: number, state: State): Promise<void>;
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
    engine: StateEngine
): Promise<SolStateMerkleProof> {
    const { state, witness } = await engine.get(senderID);
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
    await engine.update(senderID, postState);
    return { state, witness };
}

async function processReceiver(
    receiverID: number,
    increment: BigNumber,
    tokenID: number,
    engine: StateEngine
): Promise<SolStateMerkleProof> {
    const { state, witness } = await engine.get(receiverID);
    if (state.tokenID != tokenID)
        throw new WrongTokenID(
            `Tx tokenID: ${tokenID}, State tokenID: ${state.tokenID}`
        );
    const postState = applyReceiver(state, increment);
    await engine.update(receiverID, postState);
    return { state, witness };
}

async function processTransfer(
    tx: TxTransfer,
    tokenID: number,
    engine: StateEngine
): Promise<SolStateMerkleProof[]> {
    const senderProof = await processSender(
        tx.fromIndex,
        tokenID,
        tx.amount,
        tx.fee,
        engine
    );
    const receiverProof = await processReceiver(
        tx.toIndex,
        tx.amount,
        tokenID,
        engine
    );
    return [senderProof, receiverProof];
}

async function* processTransferCommit(
    txs: TxTransfer[],
    feeReceiverID: number,
    engine: StateEngine
): AsyncGenerator<SolStateMerkleProof> {
    const tokenID = (await engine.getNoWitness(feeReceiverID)).tokenID;
    for (const tx of txs) {
        const [senderProof, receiverProof] = await processTransfer(
            tx,
            tokenID,
            engine
        );
        yield senderProof;
        yield receiverProof;
    }
    const proof = await processReceiver(
        feeReceiverID,
        sum(txs.map(tx => tx.fee)),
        tokenID,
        engine
    );
    yield proof;
    return;
}

export class MemEngine implements StateEngine {
    public static new(stateDepth: number) {
        return new this(stateDepth);
    }
    private tree: Tree;
    private states: { [key: number]: State } = {};
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

    public async getNoWitness(stateID: number): Promise<State> {
        this.checkSize(stateID);
        const state = this.states[stateID];
        if (!state) throw new StateNotExist(`stateID: ${stateID}`);
        return state;
    }

    public async get(stateID: number): Promise<SolStateMerkleProof> {
        const state = await this.getNoWitness(stateID);
        const witness = this.tree.witness(stateID).nodes;
        return { state, witness };
    }

    /** Side effect! */
    public async update(stateID: number, state: State) {
        this.checkSize(stateID);
        this.states[stateID] = state;
        this.tree.updateSingle(stateID, state.toStateLeaf());
    }

    public async create(stateID: number, state: State) {
        if (this.states[stateID])
            throw new StateAlreadyExist(`stateID: ${stateID}`);
        this.update(stateID, state);
    }
}
