import { TestTxFactory } from "../types/ethers-contracts/TestTxFactory";
import { TestTx } from "../types/ethers-contracts/TestTx";
import { TxTransfer, serialize, TxMassMigration } from "../ts/tx";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { COMMIT_SIZE } from "../ts/constants";

describe("Tx Serialization", async () => {
    let c: TestTx;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        c = await new TestTxFactory(signer).deploy();
    });

    it("parse transfer transaction", async function() {
        const txs = TxTransfer.buildList(COMMIT_SIZE);
        const { serialized } = serialize(txs);
        assert.equal(
            (await c.transfer_size(serialized)).toNumber(),
            txs.length
        );
        assert.isFalse(await c.transfer_hasExcessData(serialized));
        for (let i in txs) {
            const { fromIndex, toIndex, amount, fee } = await c.transfer_decode(
                serialized,
                i
            );
            assert.equal(fromIndex.toString(), txs[i].fromIndex.toString());
            assert.equal(toIndex.toString(), txs[i].toIndex.toString());
            assert.equal(amount.toString(), txs[i].amount.toString());
            assert.equal(fee.toString(), txs[i].fee.toString());
            const message = await c.transfer_messageOf(
                serialized,
                i,
                txs[i].nonce
            );
            assert.equal(message, txs[i].message());
        }
    });
    it("serialize transfer transaction", async function() {
        const txs = TxTransfer.buildList(COMMIT_SIZE);
        const { serialized } = serialize(txs);
        const _serialized = await c.transfer_serialize(txs);
        assert.equal(serialized, _serialized);
    });
    it("transfer trasaction casting", async function() {
        const txs = TxTransfer.buildList(COMMIT_SIZE);
        const txsInBytes = [];
        for (const tx of txs) {
            const extended = tx.extended();
            const bytes = await c.transfer_bytesFromEncoded(extended);
            txsInBytes.push(bytes);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.transfer_serializeFromEncoded(txsInBytes);
        assert.equal(serialized, _serialized);
    });

    it("massMigration", async function() {
        const txs = TxMassMigration.buildList(COMMIT_SIZE);
        const { serialized } = serialize(txs);
        const size = await c.massMigration_size(serialized);
        assert.equal(size.toNumber(), txs.length);
        for (let i in txs) {
            const {
                fromIndex,
                toIndex,
                amount,
                spokeID,
                fee
            } = await c.massMigration_decode(serialized, i);
            assert.equal(fromIndex.toString(), txs[i].fromIndex.toString());
            assert.equal(toIndex.toString(), txs[i].toIndex.toString());
            assert.equal(amount.toString(), txs[i].amount.toString());
            assert.equal(spokeID.toString(), txs[i].spokeID.toString());
            assert.equal(fee.toString(), txs[i].fee.toString());
        }
    });
});
