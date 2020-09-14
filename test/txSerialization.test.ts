import { TestTxFactory } from "../types/ethers-contracts/TestTxFactory";
import { TestTx } from "../types/ethers-contracts/TestTx";
import { TxTransfer, serialize } from "../ts/tx";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";

describe("Tx Serialization", async () => {
    let c: TestTx;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        c = await new TestTxFactory(signer).deploy();
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
            const fromIndex = await c.transfer_fromIndexOf(serialized, i);
            const toIndex = await c.transfer_toIndexOf(serialized, i);
            const amount = await c.transfer_amountOf(serialized, i);
            const fee = await c.transfer_feeOf(serialized, i);

            assert.equal(fromIndex.toNumber(), txs[i].fromIndex);
            assert.equal(toIndex.toNumber(), txs[i].toIndex);
            assert.equal(amount.toNumber(), txs[i].amount);
            assert.equal(fee.toNumber(), txs[i].fee);
            const decoded = await c.transfer_decode(serialized, i);
            assert.equal(
                decoded.fromIndex.toString(),
                txs[i].fromIndex.toString()
            );
            assert.equal(decoded.toIndex.toString(), txs[i].toIndex.toString());
            assert.equal(decoded.amount.toString(), txs[i].amount.toString());
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
        const txSize = 16;
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
        const _serialized = await c.transfer_serializeFromEncoded(txsInBytes);
        assert.equal(serialized, _serialized);
    });
});
