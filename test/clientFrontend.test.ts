import { assert } from "chai";
import { serialize, TxTransfer } from "../ts/tx";
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
});
