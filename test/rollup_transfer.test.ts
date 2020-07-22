const TestTransferRollup = artifacts.require("TestTransferRollup");
const BLSAccountRegistry = artifacts.require("BLSAccountRegistry");
const RollupUtilsLib = artifacts.require("RollupUtils");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
import {TestTransferRollupInstance} from "../types/truffle-contracts";
import {TxTransfer, serialize, calculateRoot} from "./utils/tx";
import * as mcl from "./utils/mcl";
import {StateTree} from "./utils/state_tree";
import {Account} from "./utils/state_account";
import {AccountRegistry} from "./utils/account_tree";

const STATE_TREE_DEPTH: number = 32;

contract("Rollup transfer", eth_accounts => {
  let C: TestTransferRollupInstance;
  let registry: AccountRegistry;
  let stateTree: StateTree;
  const accounts: Account[] = [];
  const tokenID = 1;
  const accountSize = 16;
  const STAKE = web3.utils.toWei("1", "gwei");
  const initialBalance = 1000;
  const initialNonce = 10;

  before(async function() {
    await mcl.init();
    const registryContract = await BLSAccountRegistry.new();
    registry = await AccountRegistry.new(registryContract);
    const merkleTreeUtils = await MerkleTreeUtils.new();
    let rollupUtilsLib = await RollupUtilsLib.new();
    await TestTransferRollup.link("RollupUtils", rollupUtilsLib.address);
    C = await TestTransferRollup.new(
      registryContract.address,
      merkleTreeUtils.address
    );
    stateTree = StateTree.new(STATE_TREE_DEPTH);
    // create accounts
    for (let i = 0; i < accountSize; i++) {
      const accountID = i;
      const stateID = i + 1000;
      const account = Account.new(
        accountID,
        tokenID,
        initialBalance,
        initialNonce
      )
        .setStateID(stateID)
        .newKeyPair();
      accounts.push(account);
      await registry.register(account.encodePubkey());
    }
  });
  beforeEach(async function() {
    stateTree = StateTree.new(STATE_TREE_DEPTH);
    for (let i = 0; i < accountSize; i++) {
      stateTree.createAccount(accounts[i]);
    }
  });
  // TODO: test negative transition paths
  it("Transfer: process state transition", async function() {
    // Save entry state root
    const stateRoot0 = stateTree.root;
    // Prapere some transactions
    const batchSize = 16;
    const txs: TxTransfer[] = [];
    const amount = 2;
    for (let i = 0; i < batchSize; i++) {
      const senderAccount = accounts[i % accountSize];
      const receiverAccount = accounts[(i + 5) % accountSize];
      const tx = new TxTransfer(
        senderAccount.stateID,
        receiverAccount.stateID,
        amount,
        senderAccount.nonce
      );
      txs.push(tx);
    }

    // Apply it to the local state
    const {proof, safe} = stateTree.applyTransferBatch(txs);
    const stateRoot10 = stateTree.root;
    assert.isTrue(safe);

    const {serialized} = serialize(txs);

    // Should be equal to local root
    const res = await C.processBatch(stateRoot0, serialized, proof);
    const fraudCode = res[1];
    const stateRoot11 = res[0];
    assert.equal(stateRoot10, stateRoot11);
    assert.equal(0, fraudCode.toNumber());
  });
  // TODO: test negative signature paths
  it("Transfer: signature check", async function() {
    // Prapere some signed transactions
    const batchSize = 16;
    const txs: TxTransfer[] = [];
    const amount = 2;

    let aggSignature = mcl.newG1();
    const pubkeys = [];
    const witnesses = [];
    let signersSerialized = "0x";

    for (let i = 0; i < batchSize; i++) {
      const senderAccount = accounts[i % accountSize];
      const receiverAccount = accounts[(i + 5) % accountSize];
      const tx = new TxTransfer(
        senderAccount.stateID,
        receiverAccount.stateID,
        amount,
        senderAccount.nonce
      );
      txs.push(tx);

      console.log(senderAccount.accountID);
      // Collect sender public key and account witness
      pubkeys.push(senderAccount.encodePubkey());
      witnesses.push(registry.witness(senderAccount.accountID));
      signersSerialized += senderAccount.encodeAccountID();

      // Sender signs the transaction
      const signature = senderAccount.sign(tx);

      // Agregate signature
      aggSignature = mcl.aggreagate(aggSignature, signature);
    }

    let signature = mcl.g1ToHex(aggSignature);
    const accountProofs = {witnesses, pubkeys};

    const {serialized} = serialize(txs);

    const fraudCode = await C.signatureCheck(
      signature,
      accountProofs,
      serialized,
      signersSerialized
    );
    assert.equal(0, fraudCode.toNumber());
  });
  it.only("Transfer: signer account check", async function() {
    const batchSize = 16;
    const amount = 2;
    const txs: TxTransfer[] = [];

    let signersSerialized = "0x";
    let signersSerializedInvalid = "0x";
    let witnesses = [];
    let signerAccounts = [];
    for (let i = 0; i < batchSize; i++) {
      const senderAccount = accounts[i % accountSize];
      const receiverAccount = accounts[(i + 5) % accountSize];
      const tx = new TxTransfer(
        senderAccount.stateID,
        receiverAccount.stateID,
        amount,
        senderAccount.nonce
      );
      txs.push(tx);
      signersSerialized += senderAccount.encodeAccountID();
      signersSerializedInvalid += "aabbccdd";
      witnesses.push(stateTree.getAccountWitness(senderAccount.stateID));
      signerAccounts.push(senderAccount.toSolStruct());
    }
    const {serialized} = serialize(txs);

    for (let i = 0; i < batchSize; i++) {
      const proof = {
        targetIndex: i,
        account: signerAccounts[i],
        witness: witnesses[i]
      };
      const fraudCode = await C.signerAccountCheck(
        proof,
        stateTree.root,
        signersSerialized,
        serialized
      );
      assert.equal(0, fraudCode.toNumber());
    }
    for (let i = 0; i < batchSize; i++) {
      const proof = {
        targetIndex: i,
        account: signerAccounts[i],
        witness: witnesses[i]
      };
      const fraudCode = await C.signerAccountCheck(
        proof,
        stateTree.root,
        signersSerializedInvalid,
        serialized
      );
      assert.equal(1, fraudCode.toNumber());
    }
  });
});
