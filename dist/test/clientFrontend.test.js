"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const tx_1 = require("../ts/tx");
const buidler_1 = require("@nomiclabs/buidler");
const ethers_contracts_1 = require("../types/ethers-contracts");
describe("Client Frontend", async function () {
    let contract;
    before(async function () {
        const [signer] = await buidler_1.ethers.getSigners();
        contract = await new ethers_contracts_1.ClientFrontendFactory(signer).deploy();
    });
    it("Decodes Transfer", async function () {
        for (let i = 0; i < 100; i++) {
            const tx = tx_1.TxTransfer.rand();
            const _tx = await contract.decodeTransfer(tx.encodeOffchain());
            chai_1.assert.equal(_tx.fromIndex.toNumber(), tx.fromIndex);
            chai_1.assert.equal(_tx.toIndex.toNumber(), tx.toIndex);
            chai_1.assert.equal(_tx.amount.toString(), tx.amount.toString());
            chai_1.assert.equal(_tx.fee.toString(), tx.fee.toString());
            chai_1.assert.equal(_tx.nonce.toNumber(), tx.nonce);
        }
    });
    it("Decodes MassMigration", async function () {
        for (let i = 0; i < 100; i++) {
            const tx = tx_1.TxMassMigration.rand();
            const _tx = await contract.decodeMassMigration(tx.encodeOffchain());
            chai_1.assert.equal(_tx.fromIndex.toNumber(), tx.fromIndex);
            chai_1.assert.equal(_tx.amount.toString(), tx.amount.toString());
            chai_1.assert.equal(_tx.fee.toString(), tx.fee.toString());
            chai_1.assert.equal(_tx.spokeID.toNumber(), tx.spokeID);
            chai_1.assert.equal(_tx.nonce.toNumber(), tx.nonce);
        }
    });
    it("Decodes Create2Transfer", async function () {
        for (let i = 0; i < 100; i++) {
            const tx = tx_1.TxCreate2Transfer.rand();
            const _tx = await contract.decodeCreate2Transfer(tx.encodeOffchain());
            chai_1.assert.equal(_tx.fromIndex.toNumber(), tx.fromIndex);
            chai_1.assert.equal(_tx.toIndex.toNumber(), tx.toIndex);
            chai_1.assert.equal(_tx.toAccID.toNumber(), tx.toAccID);
            chai_1.assert.equal(_tx.amount.toString(), tx.amount.toString());
            chai_1.assert.equal(_tx.fee.toString(), tx.fee.toString());
            chai_1.assert.equal(_tx.nonce.toNumber(), tx.nonce);
        }
    });
});
//# sourceMappingURL=clientFrontend.test.js.map