"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const TestTxFactory_1 = require("../types/ethers-contracts/TestTxFactory");
const mcl = __importStar(require("../ts/mcl"));
const tx_1 = require("../ts/tx");
const chai_1 = require("chai");
const buidler_1 = require("@nomiclabs/buidler");
const constants_1 = require("../ts/constants");
const factory_1 = require("../ts/factory");
describe("Tx Serialization", async () => {
    let c;
    before(async function () {
        const [signer, ...rest] = await buidler_1.ethers.getSigners();
        c = await new TestTxFactory_1.TestTxFactory(signer).deploy();
    });
    it("parse transfer transaction", async function () {
        const txs = tx_1.TxTransfer.buildList(constants_1.COMMIT_SIZE);
        const serialized = tx_1.serialize(txs);
        chai_1.assert.equal((await c.transferSize(serialized)).toNumber(), txs.length);
        chai_1.assert.isFalse(await c.transferHasExcessData(serialized));
        for (let i in txs) {
            const { fromIndex, toIndex, amount, fee } = await c.transferDecode(serialized, i);
            chai_1.assert.equal(fromIndex.toString(), txs[i].fromIndex.toString());
            chai_1.assert.equal(toIndex.toString(), txs[i].toIndex.toString());
            chai_1.assert.equal(amount.toString(), txs[i].amount.toString());
            chai_1.assert.equal(fee.toString(), txs[i].fee.toString());
            const message = await c.transferMessageOf(serialized, i, txs[i].nonce);
            chai_1.assert.equal(message, txs[i].message());
        }
    });
    it("parse create2transfer transaction", async function () {
        await mcl.init();
        let states = factory_1.UserStateFactory.buildList(constants_1.COMMIT_SIZE);
        let newStates = factory_1.UserStateFactory.buildList(32, states.length, states.length);
        const txs = factory_1.txCreate2TransferFactory(states, newStates, constants_1.COMMIT_SIZE);
        const serialized = tx_1.serialize(txs);
        chai_1.assert.equal((await c.create2transferSize(serialized)).toNumber(), txs.length);
        chai_1.assert.isFalse(await c.create2transferHasExcessData(serialized));
        for (let i in txs) {
            const { fromIndex, toIndex, toAccID, amount, fee } = await c.create2TransferDecode(serialized, i);
            chai_1.assert.equal(fromIndex.toString(), txs[i].fromIndex.toString(), "from index not equal");
            chai_1.assert.equal(toIndex.toString(), txs[i].toIndex.toString(), "to index not equal");
            chai_1.assert.equal(toAccID.toString(), txs[i].toAccID.toString(), "to acc ID not equal");
            chai_1.assert.equal(amount.toString(), txs[i].amount.toString(), "amount not equal");
            chai_1.assert.equal(fee.toString(), txs[i].fee.toString(), "fee not equal");
            const message = await c.create2TransferMessageOf(serialized, i, txs[i].nonce, txs[i].fromPubkey, txs[i].toPubkey);
            chai_1.assert.equal(message, txs[i].message());
        }
    });
    it("serialize transfer transaction", async function () {
        const txs = tx_1.TxTransfer.buildList(constants_1.COMMIT_SIZE);
        chai_1.assert.equal(await c.transferSerialize(txs), tx_1.serialize(txs));
    });
    it("serialize create2transfer transaction", async function () {
        const txs = tx_1.TxCreate2Transfer.buildList(constants_1.COMMIT_SIZE);
        chai_1.assert.equal(await c.create2transferSerialize(txs), tx_1.serialize(txs));
    });
    it("massMigration", async function () {
        const txs = tx_1.TxMassMigration.buildList(constants_1.COMMIT_SIZE);
        const serialized = tx_1.serialize(txs);
        const size = await c.massMigrationSize(serialized);
        chai_1.assert.equal(size.toNumber(), txs.length);
        for (let i in txs) {
            const { fromIndex, amount, fee } = await c.massMigrationDecode(serialized, i);
            chai_1.assert.equal(fromIndex.toString(), txs[i].fromIndex.toString());
            chai_1.assert.equal(amount.toString(), txs[i].amount.toString());
            chai_1.assert.equal(fee.toString(), txs[i].fee.toString());
            const message = await c.testMassMigrationMessageOf(txs[i], txs[i].nonce, txs[i].spokeID);
            chai_1.assert.equal(message, txs[i].message(), "message should be the same");
        }
    });
});
//# sourceMappingURL=txSerialization.test.js.map