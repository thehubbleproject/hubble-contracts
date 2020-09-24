import { BigNumber } from "ethers";
import { COMMIT_SIZE } from "./constants";
import { USDT } from "./decimal";
import { State } from "./state";
import { TxTransfer } from "./tx";
import * as Factory from "factory.ts";
import { randomNum } from "./utils";

export class UserStateFactory {
    public static buildList(
        numOfStates: number,
        tokenID: number = 1,
        initialBalance: BigNumber = USDT.castInt(1000.0),
        initialNonce: number = 9
    ) {
        const states: State[] = [];
        for (let i = 0; i < numOfStates; i++) {
            const accountID = i;
            const stateID = i;
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
    const amount = states[0].balance.div(10);
    const fee = amount.div(10);
    for (let i = 0; i < n; i++) {
        const senderIndex = i;
        const reciverIndex = (i + 5) % n;
        const sender = states[senderIndex];
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
