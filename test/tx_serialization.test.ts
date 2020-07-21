const TestTx = artifacts.require("TestTx");
import { TestTxInstance } from "../types/truffle-contracts";
import { TxTransfer, serialize, TxCreate } from "./utils/tx";

contract("Tx Serialization", accounts => {
    let c: TestTxInstance;
    before(async function() {
        c = await TestTx.new();
    });
    it("parse transfer transaction", async function() {
        const txSize = 32;
        const txs: TxTransfer[] = [];
        for (let i = 0; i < txSize; i++) {
            txs.push(TxTransfer.rand());
        }
        const { serialized } = serialize(txs);
        assert.equal(txSize, (await c.transfer_size(serialized)).toNumber());
        assert.isFalse(await c.transfer_hasExcessData(serialized));
        for (let i = 0; i < txSize; i++) {
            let amount = (await c.transfer_amountOf(serialized, i)).toNumber();
            assert.equal(amount, txs[i].amount);
            let sender = (await c.transfer_senderOf(serialized, i)).toNumber();
            assert.equal(sender, txs[i].senderID);
            let receiver = (
                await c.transfer_receiverOf(serialized, i)
            ).toNumber();
            assert.equal(receiver, txs[i].receiverID);
            let h0 = txs[i].hash();
            let h1 = await c.transfer_hashOf(serialized, i);
            assert.equal(h0, h1);
        }
    });
    it("serialize transfer transaction", async function() {
        const txSize = 64;
        const txs: TxTransfer[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxTransfer.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.transfer_serialize(txs);
        assert.equal(serialized, _serialized);
    });
    it("parse create transaction", async function() {
        const txSize = 32;
        const txs: TxCreate[] = [];
        for (let i = 0; i < txSize; i++) {
            txs.push(TxCreate.rand());
        }
        const { serialized } = serialize(txs);
        assert.equal(txSize, (await c.create_size(serialized)).toNumber());
        assert.isFalse(await c.create_hasExcessData(serialized));
        for (let i = 0; i < txSize; i++) {
            let accountID = (
                await c.create_accountIdOf(serialized, i)
            ).toNumber();
            assert.equal(accountID, txs[i].accountID);
            let stateID = (await c.create_stateIdOf(serialized, i)).toNumber();
            assert.equal(stateID, txs[i].stateID);
            let token = (await c.create_tokenOf(serialized, i)).toNumber();
            assert.equal(token, txs[i].token);
            let h0 = txs[i].hash();
            let h1 = await c.create_hashOf(serialized, i);
            assert.equal(h0, h1);
        }
    });
    it("serialize create transaction", async function() {
        const txSize = 64;
        const txs: TxCreate[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxCreate.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.create_serialize(txs);
        assert.equal(serialized, _serialized);
    });
});
