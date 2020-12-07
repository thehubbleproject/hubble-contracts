import { BigNumber } from "ethers";
import { aggregate, BlsSigner } from "./blsSigner";
import { COMMIT_SIZE } from "./constants";
import { USDT } from "./decimal";
import { Domain, solG1 } from "./mcl";
import { State } from "./state";
import { StateTree } from "./stateTree";
import {
    TxTransfer,
    TxCreate2Transfer,
    TxMassMigration,
    SignableTx
} from "./tx";

export class User {
    static new(domain: Domain, stateID: number, pubkeyID: number) {
        const signer = BlsSigner.new(domain);
        return new User(signer, stateID, pubkeyID);
    }
    constructor(
        public blsSigner: BlsSigner,
        public stateID: number,
        public pubkeyID: number
    ) {}
    public sign(tx: SignableTx) {
        return this.blsSigner.sign(tx.message());
    }
    get pubkey() {
        return this.blsSigner.pubkey;
    }
}
export class UserStateFactory {
    public static buildList(
        numOfStates: number,
        domain: Domain,
        initialStateID: number = 0,
        initialpubkeyID: number = 0,
        tokenID: number = 1,
        initialBalance: BigNumber = USDT.castInt(1000.0),
        initialNonce: number = 9
    ): { users: User[]; states: State[] } {
        const users: User[] = [];
        const states: State[] = [];
        for (let i = 0; i < numOfStates; i++) {
            const pubkeyID = initialpubkeyID + i;
            const stateID = initialStateID + i;
            const state = State.new(
                pubkeyID,
                tokenID,
                initialBalance,
                initialNonce + i
            );
            const user = User.new(domain, stateID, pubkeyID);
            states.push(state);
            users.push(user);
        }
        return { users, states };
    }
}

export function txTransferFactory(
    users: User[],
    stateTree: StateTree,
    n: number = COMMIT_SIZE
): { txs: TxTransfer[]; signature: solG1 } {
    const txs: TxTransfer[] = [];
    const signatures = [];
    for (let i = 0; i < n; i++) {
        const sender = users[i];
        const reciver = users[(i + 5) % n];
        const senderState = stateTree.getState(sender.stateID);
        const amount = senderState.balance.div(10);
        const fee = amount.div(10);
        const tx = new TxTransfer(
            sender.stateID,
            reciver.stateID,
            amount,
            fee,
            senderState.nonce,
            USDT
        );
        txs.push(tx);
        signatures.push(sender.sign(tx));
    }
    const signature = aggregate(signatures).sol;
    return { txs, signature };
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
