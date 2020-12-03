import { BigNumber } from "ethers";
import { COMMIT_SIZE } from "./constants";
import { USDT } from "./decimal";
import { State } from "./state";
import { TxTransfer, TxCreate2Transfer, TxMassMigration } from "./tx";

interface UserStateFactoryOptions {
    numOfStates: number;
    initialStateID: number;
    initialpubkeyID: number;
    tokenID?: number;
    initialBalance?: BigNumber;
    zeroNonce?: boolean;
}

export class UserStateFactory {
    public static buildList(options: UserStateFactoryOptions) {
        const states: State[] = [];
        const tokenID = options.tokenID || 1;
        const balance = options.initialBalance || USDT.castInt(1000.0);
        const zeroNonce = options.zeroNonce || false;
        for (let i = 0; i < options.numOfStates; i++) {
            const pubkeyID = options.initialpubkeyID + i;
            const stateID = options.initialStateID + i;
            const nonce = zeroNonce ? 0 : 9 + i;
            const state = State.new(pubkeyID, tokenID, balance, nonce);
            state.setStateID(stateID);
            state.newKeyPair();
            states.push(state);
        }
        return states;
    }
}

export function txTransferFactory(
    states: State[],
    n: number = COMMIT_SIZE
): TxTransfer[] {
    const txs: TxTransfer[] = [];
    const nStates = states.length;
    for (let i = 0; i < n; i++) {
        const senderIndex = i % nStates;
        const reciverIndex = (i + 5) % n;
        const sender = states[senderIndex];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        const tx = new TxTransfer(
            senderIndex,
            reciverIndex,
            amount,
            fee,
            sender.nonce,
            USDT
        );
        txs.push(tx);
    }
    return txs;
}

// creates N new transactions with existing sender and non-existent receiver
export function txCreate2TransferFactory(
    states: State[],
    newStates: State[],
    n: number = COMMIT_SIZE
): TxCreate2Transfer[] {
    const txs: TxCreate2Transfer[] = [];
    for (let i = 0; i < n; i++) {
        const sender = states[i];
        const receiver = newStates[i];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);

        // uses states for sender
        // and newStates for receiver as they are not created yet
        const tx = new TxCreate2Transfer(
            sender.stateID,
            receiver.stateID,
            receiver.getPubkey(),
            receiver.pubkeyID,
            amount,
            fee,
            sender.nonce,
            USDT
        );
        txs.push(tx);
    }
    return txs;
}

export function txMassMigrationFactory(
    states: State[],
    n: number = COMMIT_SIZE,
    spokeID = 0
): TxMassMigration[] {
    const txs: TxMassMigration[] = [];
    for (let i = 0; i < n; i++) {
        const sender = states[i];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        const tx = new TxMassMigration(
            sender.stateID,
            amount,
            spokeID,
            fee,
            sender.nonce,
            USDT
        );
        txs.push(tx);
    }
    return txs;
}
