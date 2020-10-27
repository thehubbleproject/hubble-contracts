import { assert } from "chai";
import {
    serialize,
    TxCreate2Transfer,
    TxMassMigration,
    TxTransfer
} from "../ts/tx";
import { ethers } from "@nomiclabs/buidler";
import { ClientFrontend } from "../types/ethers-contracts/ClientFrontend";
import { ClientFrontendFactory } from "../types/ethers-contracts";
import { State } from "../ts/state";
import * as mcl from "../ts/mcl";
import { randHex } from "../ts/utils";

const DOMAIN = randHex(32);
describe("Client Frontend", async function() {
    let contract: ClientFrontend;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contract = await new ClientFrontendFactory(signer).deploy();
        mcl.setDomainHex(DOMAIN);
        await mcl.init();
    });

    it("Transfer", async function() {
        const txs = [];
        const txsEncoded = [];
        for (let i = 0; i < 100; i++) {
            const tx = TxTransfer.rand();
            const encodedTx = tx.encodeOffchain();
            const _tx = await contract.decodeTransfer(encodedTx);
            assert.equal(_tx.fromIndex.toNumber(), tx.fromIndex);
            assert.equal(_tx.toIndex.toNumber(), tx.toIndex);
            assert.equal(_tx.amount.toString(), tx.amount.toString());
            assert.equal(_tx.fee.toString(), tx.fee.toString());
            assert.equal(_tx.nonce.toNumber(), tx.nonce);
            txs.push(tx);
            txsEncoded.push(encodedTx);
        }
        assert.equal(
            await contract.compressTransfer(txsEncoded),
            serialize(txs)
        );
    });
    it("MassMigration", async function() {
        const txs = [];
        const txsEncoded = [];
        for (let i = 0; i < 100; i++) {
            const tx = TxMassMigration.rand();
            const encodedTx = tx.encodeOffchain();
            const _tx = await contract.decodeMassMigration(tx.encodeOffchain());
            assert.equal(_tx.fromIndex.toNumber(), tx.fromIndex);
            assert.equal(_tx.amount.toString(), tx.amount.toString());
            assert.equal(_tx.fee.toString(), tx.fee.toString());
            assert.equal(_tx.spokeID.toNumber(), tx.spokeID);
            assert.equal(_tx.nonce.toNumber(), tx.nonce);
            txs.push(tx);
            txsEncoded.push(encodedTx);
        }
        assert.equal(
            await contract.compressMassMigration(txsEncoded),
            serialize(txs)
        );
    });
    it("Create2Transfer", async function() {
        const txs = [];
        const txsEncoded = [];
        for (let i = 0; i < 100; i++) {
            const tx = TxCreate2Transfer.rand();
            const encodedTx = tx.encodeOffchain();
            const _tx = await contract.decodeCreate2Transfer(encodedTx);
            assert.equal(_tx.fromIndex.toNumber(), tx.fromIndex);
            assert.equal(_tx.toIndex.toNumber(), tx.toIndex);
            assert.equal(_tx.toAccID.toNumber(), tx.toAccID);
            assert.equal(_tx.amount.toString(), tx.amount.toString());
            assert.equal(_tx.fee.toString(), tx.fee.toString());
            assert.equal(_tx.nonce.toNumber(), tx.nonce);
            txs.push(tx);
            txsEncoded.push(encodedTx);
        }
        assert.equal(
            await contract.compressCreate2Transfer(txsEncoded),
            serialize(txs)
        );
    });

    it("Validate transfer", async function() {
        const tx = TxTransfer.rand();
        const user = State.new(0, 0, 0, 0).newKeyPair();
        const signature = user.sign(tx);
        await contract.valiateTransfer(
            tx.encodeOffchain(),
            mcl.g1ToHex(signature),
            user.getPubkey(),
            DOMAIN
        );
    });

    it("Validate MassMigration", async function() {
        const tx = TxMassMigration.rand();
        const user = State.new(0, 0, 0, 0).newKeyPair();
        const signature = user.sign(tx);
        await contract.valiateMassMigration(
            tx.encodeOffchain(),
            mcl.g1ToHex(signature),
            user.getPubkey(),
            DOMAIN
        );
    });
    it("Validate create2Transfer", async function() {
        const tx = TxCreate2Transfer.rand();
        const sender = State.new(0, 0, 0, 0).newKeyPair();
        const receiver = State.new(0, 0, 0, 0).newKeyPair();
        tx.fromPubkey = sender.getPubkey();
        tx.toPubkey = receiver.getPubkey();
        const signature = sender.sign(tx);
        await contract.valiateCreate2Transfer(
            tx.encodeOffchain(),
            mcl.g1ToHex(signature),
            tx.fromPubkey,
            tx.toPubkey,
            DOMAIN
        );
    });
});
