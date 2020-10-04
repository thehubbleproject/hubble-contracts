import { TestTxFactory } from "../types/ethers-contracts/TestTxFactory";
import * as mcl from "../ts/mcl";
import { TestTx } from "../types/ethers-contracts/TestTx";
import {
    TxTransfer,
    serialize,
    TxMassMigration,
    TxCreate2Transfer
} from "../ts/tx";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { COMMIT_SIZE } from "../ts/constants";
import { txCreate2TransferFactory, UserStateFactory } from "../ts/factory";

describe("Tx Serialization", async () => {
    let c: TestTx;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        c = await new TestTxFactory(signer).deploy();
    });
    it("parse transfer transaction", async function() {
        const txs = TxTransfer.buildList(COMMIT_SIZE);
        const serialized = serialize(txs);
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
    it("parse create2transfer transaction", async function() {
        await mcl.init();
        let states = UserStateFactory.buildList(COMMIT_SIZE);
        let newStates = UserStateFactory.buildList(
            32,
            states.length,
            states.length
        );
        const txs = txCreate2TransferFactory(states,newStates,  COMMIT_SIZE);
        const serialized = serialize(txs);
        assert.equal(
            (await c.create2transfer_size(serialized)).toNumber(),
            txs.length
        );
        assert.isFalse(await c.create2transfer_hasExcessData(serialized));
        for (let i in txs) {
            const {
                fromIndex,
                toIndex,
                toAccID,
                amount,
                fee
            } = await c.create2Transfer_decode(serialized, i);

            assert.equal(
                fromIndex.toString(),
                txs[i].fromIndex.toString(),
                "from index not equal"
            );
            assert.equal(
                toIndex.toString(),
                txs[i].toIndex.toString(),
                "to index not equal"
            );
            assert.equal(
                toAccID.toString(),
                txs[i].toAccID.toString(),
                "to acc ID not equal"
            );
            // TODO fix
            // assert.equal(
            //     amount.toString(),
            //     txs[i].amount.toString(),
            //     "amount not equal"
            // );
            assert.equal(
                fee.toString(),
                txs[i].fee.toString(),
                "fee not equal"
            );

            console.log(
                "pubkey in trasnctions",
                txs[i].fromPubkey,
                txs[i].toPubkey
            );
            const message = await c.create2Transfer_messageOf(
                serialized,
                i,
                txs[i].nonce,
                txs[i].fromPubkey,
                txs[i].toPubkey
            );
            assert.equal(message, txs[i].message());
        }
    });
    it("serialize transfer transaction", async function() {
        const txs = TxTransfer.buildList(COMMIT_SIZE);
        assert.equal(await c.transfer_serialize(txs), serialize(txs));
    });
    it("serialize create2transfer transaction", async function() {
        const txs = TxCreate2Transfer.buildList(COMMIT_SIZE);
        assert.equal(await c.create2transfer_serialize(txs), serialize(txs));
    });
    it("transfer trasaction casting", async function() {
        const txs = TxTransfer.buildList(COMMIT_SIZE);
        const txsInBytes = [];
        for (const tx of txs) {
            const extended = tx.extended();
            const bytes = await c.transfer_bytesFromEncoded(extended);
            txsInBytes.push(bytes);
        }
        const serialized = await c.transfer_serializeFromEncoded(txsInBytes);
        assert.equal(serialized, serialize(txs));
    });

    it("massMigration", async function() {
        const txs = TxMassMigration.buildList(COMMIT_SIZE);
        const serialized = serialize(txs);
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
