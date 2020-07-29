const TestTx = artifacts.require("TestTx");
const RollupUtilsLib = artifacts.require("RollupUtils");
import {
    TestTxInstance,
    RollupUtilsInstance
} from "../types/truffle-contracts";
import { TxTransfer, serialize } from "./utils/tx";

contract("Tx Serialization", accounts => {
    let c: TestTxInstance;
    let rollupUtils: RollupUtilsInstance;
    before(async function() {
        rollupUtils = await RollupUtilsLib.new();
        c = await TestTx.new();
    });
    it("parse transfer transaction", async function() {
        const txSize = 16;
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
            const fromIndex = (
                await c.transfer_fromIndexOf(serialized, i)
            ).toNumber();
            const toIndex = (
                await c.transfer_toIndexOf(serialized, i)
            ).toNumber();
            const signature = await c.transfer_signatureOf(serialized, i);
            assert.equal(amount, txs[i].amount);
            assert.equal(fromIndex, txs[i].fromIndex);
            assert.equal(toIndex, txs[i].toIndex);
            assert.equal(signature, txs[i].signature);
            const decoded = await c.transfer_decode(serialized, i);
            assert.equal(
                decoded.fromIndex.toString(),
                txs[i].fromIndex.toString()
            );
            assert.equal(decoded.toIndex.toString(), txs[i].toIndex.toString());
            assert.equal(decoded.amount.toString(), txs[i].amount.toString());
            assert.equal(txs[i].signature, decoded.signature);
        }
    });
    it("serialize transfer transaction", async function() {
        const txSize = 16;
        const txs: TxTransfer[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxTransfer.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.transfer_serialize(txs);
        assert.equal(serialized, _serialized);
    });
    it("transfer trasaction casting", async function() {
        const txSize = 1;
        const txs = [];
        const txsInBytes = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxTransfer.rand();
            const extended = tx.extended();
            const bytes = await c.transfer_bytesFromEncoded(extended);
            txs.push(tx);
            txsInBytes.push(bytes);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.transfer_serializeFromEncodedBytes(
            txsInBytes
        );
        assert.equal(serialized, _serialized);
    });
});
