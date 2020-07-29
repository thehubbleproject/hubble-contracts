const TestTx = artifacts.require("TestTx");
import { TestTxInstance } from "../types/truffle-contracts";
import { TxTransfer, serialize } from "./utils/tx";
import { bnToHex, mclToHex, init as mclInit } from "./utils/mcl";

contract("Tx Serialization", accounts => {
    let c: TestTxInstance;
    before(async function() {
        await mclInit();
        c = await TestTx.new();
    });
    it("parse transfer transaction", async function() {
        const txSize = 2;
        const txs: TxTransfer[] = [];
        for (let i = 0; i < txSize; i++) {
            txs.push(TxTransfer.rand());
        }
        const { serialized } = serialize(txs);
        assert.equal(txSize, (await c.transfer_size(serialized)).toNumber());
        assert.isFalse(await c.transfer_hasExcessData(serialized));
        for (let i = 0; i < txSize; i++) {
            const amount = (
                await c.transfer_amountOf(serialized, i)
            ).toNumber();
            assert.equal(amount, txs[i].amount);
            const sender = (
                await c.transfer_senderOf(serialized, i)
            ).toNumber();
            assert.equal(sender, txs[i].senderID);
            const receiver = (
                await c.transfer_receiverOf(serialized, i)
            ).toNumber();
            assert.equal(receiver, txs[i].receiverID);
            const h0 = txs[i].hash();
            const h1 = await c.transfer_hashOf(serialized, i);
            assert.equal(h0, h1);
            const p0 = await c.transfer_mapToPoint(serialized, i);
            const p1 = txs[i].mapToPoint();
            assert.equal(p1[0], bnToHex(p0[0].toString(16)));
            assert.equal(p1[1], bnToHex(p0[1].toString(16)));
        }
    });
    it("serialize transfer transaction", async function() {
        const txSize = 32;
        const txs: TxTransfer[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxTransfer.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.transfer_serialize(txs);
        assert.equal(serialized, _serialized);
    });
});
