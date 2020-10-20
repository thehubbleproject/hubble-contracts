"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.txMassMigrationFactory = exports.txCreate2TransferFactory = exports.txTransferFactory = exports.UserStateFactory = void 0;
const constants_1 = require("./constants");
const decimal_1 = require("./decimal");
const state_1 = require("./state");
const tx_1 = require("./tx");
class UserStateFactory {
    static buildList(numOfStates, initialStateID = 0, initialAccID = 0, tokenID = 1, initialBalance = decimal_1.USDT.castInt(1000.0), initialNonce = 9) {
        const states = [];
        for (let i = 0; i < numOfStates; i++) {
            const accountID = initialAccID + i;
            const stateID = initialStateID + i;
            const state = state_1.State.new(accountID, tokenID, initialBalance, initialNonce + i);
            state.setStateID(stateID);
            state.newKeyPair();
            states.push(state);
        }
        return states;
    }
}
exports.UserStateFactory = UserStateFactory;
function txTransferFactory(states, n = constants_1.COMMIT_SIZE) {
    const txs = [];
    for (let i = 0; i < n; i++) {
        const senderIndex = i;
        const reciverIndex = (i + 5) % n;
        const sender = states[senderIndex];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        const tx = new tx_1.TxTransfer(senderIndex, reciverIndex, amount, fee, sender.nonce, decimal_1.USDT);
        txs.push(tx);
    }
    return txs;
}
exports.txTransferFactory = txTransferFactory;
// creates N new transactions with existing sender and non-existent receiver
function txCreate2TransferFactory(states, newStates, n = constants_1.COMMIT_SIZE) {
    const txs = [];
    for (let i = 0; i < n; i++) {
        const senderIndex = states[i].stateID;
        const reciverIndex = newStates[i].stateID;
        const sender = states[senderIndex];
        const receiver = newStates[i];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        // uses states for sender
        // and newStates for receiver as they are not created yet
        const tx = new tx_1.TxCreate2Transfer(senderIndex, reciverIndex, states[senderIndex].getPubkey(), receiver.getPubkey(), receiver.pubkeyIndex, amount, fee, sender.nonce, decimal_1.USDT);
        txs.push(tx);
    }
    return txs;
}
exports.txCreate2TransferFactory = txCreate2TransferFactory;
function txMassMigrationFactory(states, n = constants_1.COMMIT_SIZE, spokeID = 0) {
    const txs = [];
    for (let i = 0; i < n; i++) {
        const senderIndex = i;
        const sender = states[senderIndex];
        const amount = sender.balance.div(10);
        const fee = amount.div(10);
        const tx = new tx_1.TxMassMigration(senderIndex, amount, spokeID, fee, sender.nonce, decimal_1.USDT);
        txs.push(tx);
    }
    return txs;
}
exports.txMassMigrationFactory = txMassMigrationFactory;
//# sourceMappingURL=factory.js.map