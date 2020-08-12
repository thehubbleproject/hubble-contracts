const TestTx = artifacts.require("TestTx");
import { TestTxInstance } from "../types/truffle-contracts";
import {
    TxTransfer,
    serialize,
    TxCreate,
    TxBurnConsent,
    TxBurnExecution
} from "./utils/tx";

import * as walletHelper from "../scripts/helpers/wallet";
import * as utils from "../scripts/helpers/utils";

describe("Tx Serialization", async () => {
    let c: TestTxInstance;
    before(async function() {
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
    it("transfer trasaction signature verification", async function() {
        for (let i = 0; i < 10; i++) {
            const wallet = walletHelper.generateFirstWallets(
                walletHelper.mnemonics,
                1
            )[0];
            const tx = TxTransfer.rand();
            let { serialized } = serialize([tx]);
            const msg = await c.transfer_messageOf(serialized, 0, tx.nonce);
            const signature = utils.sign(msg, wallet);
            tx.signature = signature;
            serialized = serialize([tx]).serialized;
            const verified = await c.transfer_verify(
                serialized,
                0,
                tx.nonce,
                wallet.getAddressString()
            );
            assert.isTrue(verified);
        }
    });

    it("airdrop trasaction signature verification", async function() {
        for (let i = 0; i < 10; i++) {
            const wallet = walletHelper.generateFirstWallets(
                walletHelper.mnemonics,
                1
            )[0];
            const tx = TxTransfer.rand();
            let { serialized } = serialize([tx]);
            const msg = await c.airdrop_messageOf(serialized, 0, tx.nonce);
            const signature = utils.sign(msg, wallet);
            tx.signature = signature;
            serialized = serialize([tx]).serialized;
            const verified = await c.airdrop_verify(
                serialized,
                0,
                tx.nonce,
                wallet.getAddressString()
            );
            assert.isTrue(verified);
        }
    });
    it("parse create transaction", async function() {
        const txSize = 16;
        const txs: TxCreate[] = [];
        for (let i = 0; i < txSize; i++) {
            txs.push(TxCreate.rand());
        }
        const { serialized } = serialize(txs);
        assert.equal(txSize, (await c.create_size(serialized)).toNumber());
        assert.isFalse(await c.create_hasExcessData(serialized));
        for (let i = 0; i < txSize; i++) {
            const accountID = (
                await c.create_accountIdOf(serialized, i)
            ).toNumber();
            const stateID = (
                await c.create_stateIdOf(serialized, i)
            ).toNumber();
            const token = (await c.create_tokenOf(serialized, i)).toNumber();
            assert.equal(accountID, txs[i].accountID);
            assert.equal(stateID, txs[i].stateID);
            assert.equal(token, txs[i].tokenType);
        }
    });
    it("serialize create transaction", async function() {
        const txSize = 16;
        const txs: TxCreate[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxCreate.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.create_serialize(txs);
        assert.equal(serialized, _serialized);
    });
    it("create transaction casting", async function() {
        const txSize = 16;
        const txs = [];
        const txsInBytes = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxCreate.rand();
            const extended = tx.extended();
            const bytes = await c.create_bytesFromEncoded(extended);
            txs.push(tx);
            txsInBytes.push(bytes);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.create_serializeFromEncoded(txsInBytes);
        assert.equal(serialized, _serialized);
    });
    it("parse burn consent transaction", async function() {
        const txSize = 16;
        const txs: TxBurnConsent[] = [];
        for (let i = 0; i < txSize; i++) {
            txs.push(TxBurnConsent.rand());
        }
        const { serialized } = serialize(txs);
        assert.equal(txSize, (await c.burnConsent_size(serialized)).toNumber());
        assert.isFalse(await c.burnConsent_hasExcessData(serialized));
        for (let i = 0; i < txSize; i++) {
            const fromIndex = (
                await c.burnConsent_fromIndexOf(serialized, i)
            ).toNumber();
            const amount = (
                await c.burnConsent_amountOf(serialized, i)
            ).toNumber();
            const signature = await c.burnConsent_signatureOf(serialized, i);
            assert.equal(fromIndex, txs[i].fromIndex);
            assert.equal(amount, txs[i].amount);
            assert.equal(signature, txs[i].signature);
        }
    });
    it("serialize burn consent transaction", async function() {
        const txSize = 16;
        const txs: TxBurnConsent[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxBurnConsent.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.burnConsent_serialize(txs);
        assert.equal(serialized, _serialized);
    });
    it("burn consent transaction casting", async function() {
        const txSize = 16;
        const txs = [];
        const txsInBytes = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxBurnConsent.rand();
            const extended = tx.extended();
            const bytes = await c.burnConsent_bytesFromEncoded(extended);
            txs.push(tx);
            txsInBytes.push(bytes);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.burnConsent_serializeFromEncoded(
            txsInBytes
        );
        assert.equal(serialized, _serialized);
    });
    it("burn consent trasaction signature verification", async function() {
        for (let i = 0; i < 10; i++) {
            const wallet = walletHelper.generateFirstWallets(
                walletHelper.mnemonics,
                1
            )[0];
            const tx = TxBurnConsent.rand();
            let { serialized } = serialize([tx]);
            const msg = await c.burnConsent_messageOf(serialized, 0, tx.nonce);
            const signature = utils.sign(msg, wallet);
            tx.signature = signature;
            serialized = serialize([tx]).serialized;
            const verified = await c.burnConsent_verify(
                serialized,
                0,
                tx.nonce,
                wallet.getAddressString()
            );
            assert.isTrue(verified);
        }
    });
    it("parse burn execution transaction", async function() {
        const txSize = 16;
        const txs: TxBurnExecution[] = [];
        for (let i = 0; i < txSize; i++) {
            txs.push(TxBurnExecution.rand());
        }
        const { serialized } = serialize(txs);
        assert.equal(
            txSize,
            (await c.burnExecution_size(serialized)).toNumber()
        );
        assert.isFalse(await c.burnExecution_hasExcessData(serialized));
        for (let i = 0; i < txSize; i++) {
            const fromIndex = (
                await c.burnExecution_fromIndexOf(serialized, i)
            ).toNumber();
            assert.equal(fromIndex, txs[i].fromIndex);
        }
    });
    it("serialize burn execution transaction", async function() {
        const txSize = 16;
        const txs: TxBurnExecution[] = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxBurnExecution.rand();
            txs.push(tx);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.burnExecution_serialize(txs);
        assert.equal(serialized, _serialized);
    });
    it("burn execution transaction casting", async function() {
        const txSize = 16;
        const txs = [];
        const txsInBytes = [];
        for (let i = 0; i < txSize; i++) {
            const tx = TxBurnExecution.rand();
            const extended = tx.extended();
            const bytes = await c.burnExecution_bytesFromEncoded(extended);
            txs.push(tx);
            txsInBytes.push(bytes);
        }
        const { serialized } = serialize(txs);
        const _serialized = await c.burnExecution_serializeFromEncoded(
            txsInBytes
        );
        assert.equal(serialized, _serialized);
    });
});
