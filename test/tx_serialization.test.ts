const TestTx = artifacts.require("TestTx");
import {
  TestTxInstance,
  BurnExecutionContract
} from "../types/truffle-contracts";
import {
  TxTransfer,
  serialize,
  TxAirdropReceiver,
  TxAirdropSender,
  TxBurnConsent,
  TxBurnExecution,
  TxCreate,
  Tx
} from "./utils/tx";
import {bnToHex, mclToHex, init as mclInit} from "./utils/mcl";

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
    const {serialized} = serialize(txs);
    assert.equal(txSize, (await c.transfer_size(serialized)).toNumber());
    assert.isFalse(await c.transfer_hasExcessData(serialized));
    for (let i = 0; i < txSize; i++) {
      const amount = (await c.transfer_amountOf(serialized, i)).toNumber();
      assert.equal(amount, txs[i].amount);
      const sender = (await c.transfer_senderOf(serialized, i)).toNumber();
      assert.equal(sender, txs[i].senderID);
      const receiver = (await c.transfer_receiverOf(serialized, i)).toNumber();
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
    const {serialized} = serialize(txs);
    const _serialized = await c.transfer_serialize(txs);
    assert.equal(serialized, _serialized);
  });
  it("parse airdrop transaction", async function() {
    const txSize = 2;
    const stx = TxAirdropSender.rand();
    const rtxs: TxAirdropReceiver[] = [];
    const txs: Tx[] = [stx];
    for (let i = 0; i < txSize; i++) {
      const tx = TxAirdropReceiver.rand();
      rtxs.push(tx);
      txs.push(tx);
    }
    const {serialized} = serialize(txs);
    assert.equal(txSize, (await c.airdrop_size(serialized)).toNumber());
    assert.isFalse(await c.airdrop_hasExcessData(serialized));
    const senderAccountID = (
      await c.airdrop_senderAccountID(serialized)
    ).toNumber();
    assert.equal(senderAccountID, stx.accountID);
    const senderStateID = (
      await c.airdrop_senderStateID(serialized)
    ).toNumber();
    assert.equal(senderStateID, stx.stateID);
    const nonce = (await c.airdrop_nonce(serialized)).toNumber();
    assert.equal(nonce, stx.nonce);
    // const _stx = await c.airdrop_senderDecode(serialized);
    for (let i = 0; i < txSize; i++) {
      // const rtx = await c.airdrop_receiverDecode(serialized, i);
      const amount = (await c.airdrop_amountOf(serialized, i)).toNumber();
      assert.equal(amount, rtxs[i].amount);
      const receiverID = (await c.airdrop_receiverOf(serialized, i)).toNumber();
      assert.equal(receiverID, rtxs[i].receiverID);
    }
  });
  it("serialize airdrop transaction", async function() {
    const txSize = 2;
    const rtxs: TxAirdropReceiver[] = [];
    const stx = TxAirdropSender.rand();
    const txs: Tx[] = [stx];
    for (let i = 0; i < txSize; i++) {
      const tx = TxAirdropReceiver.rand();
      rtxs.push(tx);
      txs.push(tx);
    }
    const {serialized} = serialize(txs);
    const _serialized = await c.airdrop_serialize(stx, rtxs);
    assert.equal(serialized, _serialized);
  });
  it("parse burn consent transaction", async function() {
    const txSize = 2;
    const txs: TxBurnConsent[] = [];
    for (let i = 0; i < txSize; i++) {
      txs.push(TxBurnConsent.rand());
    }
    const {serialized} = serialize(txs);
    assert.equal(txSize, (await c.burnConsent_size(serialized)).toNumber());
    assert.isFalse(await c.burnConsent_hasExcessData(serialized));
    for (let i = 0; i < txSize; i++) {
      const stateID = (await c.burnConsent_stateIdOf(serialized, i)).toNumber();
      assert.equal(stateID, txs[i].stateID);
      const amount = (await c.burnConsent_amountOf(serialized, i)).toNumber();
      assert.equal(amount, txs[i].amount);
      const nonce = (await c.burnConsent_nonceOf(serialized, i)).toNumber();
      assert.equal(nonce, txs[i].nonce);
      const h0 = txs[i].hash();
      const h1 = await c.burnConsent_hashOf(serialized, i);
      assert.equal(h0, h1);
      const p0 = await c.burnConsent_mapToPoint(serialized, i);
      const p1 = txs[i].mapToPoint();
      assert.equal(p1[0], bnToHex(p0[0].toString(16)));
      assert.equal(p1[1], bnToHex(p0[1].toString(16)));
    }
  });
  it("serialize burn consent transaction", async function() {
    const txSize = 2;
    const txs: TxBurnConsent[] = [];
    for (let i = 0; i < txSize; i++) {
      const tx = TxBurnConsent.rand();
      txs.push(tx);
    }
    const {serialized} = serialize(txs);
    const _serialized = await c.burnConsent_serialize(txs);
    assert.equal(serialized, _serialized);
  });
  it("parse create transaction", async function() {
    const txSize = 2;
    const txs: TxCreate[] = [];
    for (let i = 0; i < txSize; i++) {
      txs.push(TxCreate.rand());
    }
    const {serialized} = serialize(txs);
    assert.equal(txSize, (await c.create_size(serialized)).toNumber());
    assert.isFalse(await c.create_hasExcessData(serialized));
    for (let i = 0; i < txSize; i++) {
      const accountID = (await c.create_accountIdOf(serialized, i)).toNumber();
      assert.equal(accountID, txs[i].accountID);
      const stateID = (await c.create_stateIdOf(serialized, i)).toNumber();
      assert.equal(stateID, txs[i].stateID);
      const token = (await c.create_tokenOf(serialized, i)).toNumber();
      assert.equal(token, txs[i].tokenType);
      const h0 = txs[i].hash();
      const h1 = await c.create_hashOf(serialized, i);
      assert.equal(h0, h1);
    }
  });
  it("serialize create transaction", async function() {
    const txSize = 32;
    const txs: TxCreate[] = [];
    for (let i = 0; i < txSize; i++) {
      const tx = TxCreate.rand();
      txs.push(tx);
    }
    const {serialized} = serialize(txs);
    const _serialized = await c.create_serialize(txs);
    assert.equal(serialized, _serialized);
  });
  it.only("parse burn execution transaction", async function() {
    const txSize = 2;
    const txs: TxBurnExecution[] = [];
    for (let i = 0; i < txSize; i++) {
      txs.push(TxBurnExecution.rand());
    }
    const {serialized} = serialize(txs);
    assert.equal(txSize, (await c.burnExecution_size(serialized)).toNumber());
    assert.isFalse(await c.burnExecution_hasExcessData(serialized));
    for (let i = 0; i < txSize; i++) {
      const stateID = (
        await c.burnExecution_stateIdOf(serialized, i)
      ).toNumber();
      assert.equal(stateID, txs[i].stateID);
      const h0 = txs[i].hash();
      const h1 = await c.burnExecution_hashOf(serialized, i);
      assert.equal(h0, h1);
    }
  });
  it.only("serialize burn execution transaction", async function() {
    const txSize = 32;
    const txs: TxBurnExecution[] = [];
    for (let i = 0; i < txSize; i++) {
      const tx = TxBurnExecution.rand();
      txs.push(tx);
    }
    const {serialized} = serialize(txs);
    const _serialized = await c.burnExecution_serialize(txs);
    assert.equal(serialized, _serialized);
  });
});
