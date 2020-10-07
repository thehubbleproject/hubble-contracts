import { BigNumber } from "ethers";
import { COMMIT_SIZE } from "./constants";
import { USDT } from "./decimal";
import { State } from "./state";
import { TxTransfer, TxCreate2Transfer, TxMassMigration } from "./tx";

export class UserStateFactory {
    public static buildList(
        numOfStates: number,
        initialStateID: number = 0,
        initialAccID: number = 0,
        tokenID: number = 1,
        initialBalance: BigNumber = USDT.castInt(1000.0),
        initialNonce: number = 9
    ) {
        const states: State[] = [];
        for (let i = 0; i < numOfStates; i++) {
            const accountID = initialAccID + i;
            const stateID = initialStateID + i;
            const state = State.new(
                accountID,
                tokenID,
                initialBalance,
                initialNonce + i
            );
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
    for (let i = 0; i < n; i++) {
        const senderIndex = i;
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
        const senderIndex = states[i].stateID;
        const reciverIndex = newStates[i].stateID;
        const sender = states[senderIndex];
        const receiver = newStates[i];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);

        // uses states for sender
        // and newStates for receiver as they are not created yet
        const tx = new TxCreate2Transfer(
            senderIndex,
            reciverIndex,
            states[senderIndex].getPubkey(),
            receiver.getPubkey(),
            receiver.pubkeyIndex,
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
        const senderIndex = i;
        const sender = states[senderIndex];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        const tx = new TxMassMigration(
            senderIndex,
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
