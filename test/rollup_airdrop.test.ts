const TestAirdropRollup = artifacts.require("TestAirdropRollup");
const BLSAccountRegistry = artifacts.require("BLSAccountRegistry");
const RollupUtilsLib = artifacts.require("RollupUtils");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
import {TestAirdropRollupInstance} from "../types/truffle-contracts";
import {TxAirdropReceiver, TxAirdropSender, serialize, Tx} from "./utils/tx";
import * as mcl from "./utils/mcl";
import {StateTree} from "./utils/state_tree";
import {Account} from "./utils/state_account";
import {AccountRegistry} from "./utils/account_tree";

const STATE_TREE_DEPTH: number = 32;

contract("Rollup transfer", eth_accounts => {
  let C: TestAirdropRollupInstance;
  let registry: AccountRegistry;
  let stateTree: StateTree;
  let helicopterAccount: Account;
  const accounts: Account[] = [];
  const tokenID = 1;
  const accountSize = 16;
  const STAKE = web3.utils.toWei("1", "gwei");
  const initialBalance = 1;
  const initialNonce = 0;

  before(async function() {
    await mcl.init();
    const registryContract = await BLSAccountRegistry.new();
    registry = await AccountRegistry.new(registryContract);
    const merkleTreeUtils = await MerkleTreeUtils.new();
    let rollupUtilsLib = await RollupUtilsLib.new();
    await TestAirdropRollup.link("RollupUtils", rollupUtilsLib.address);
    C = await TestAirdropRollup.new(
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
    // create helicopter account
    const accountID = accountSize;
    const stateID = 1;
    helicopterAccount = Account.new(accountID, tokenID, 10000, initialNonce)
      .setStateID(stateID)
      .newKeyPair();
    accounts.push(helicopterAccount);
    await registry.register(helicopterAccount.encodePubkey());
  });
  beforeEach(async function() {
    stateTree = StateTree.new(STATE_TREE_DEPTH);
    for (let i = 0; i < accountSize; i++) {
      stateTree.createAccount(accounts[i]);
    }
    stateTree.createAccount(helicopterAccount);
  });

  it("Airdrop: process state transition", async function() {
    // Save entry state root
    const stateRoot0 = stateTree.root;
    // Prapere some transactions
    const batchSize = 16;
    const amount = 2;
    let airdropAmount = amount * batchSize;
    const stx = new TxAirdropSender(
      helicopterAccount.accountID,
      helicopterAccount.stateID,
      initialNonce
    );
    const rtxs: TxAirdropReceiver[] = [];
    const txs: Tx[] = [stx];
    for (let i = 0; i < batchSize; i++) {
      const receiverAccount = accounts[(i + 5) % accountSize];
      const tx = new TxAirdropReceiver(receiverAccount.stateID, amount);
      rtxs.push(tx);
      txs.push(tx);
      airdropAmount += amount;
    }

    // Apply it to the local state
    const {senderProof, receiverProofs, safe} = stateTree.applyAirdropBatch(
      stx,
      rtxs
    );
    const stateRoot1 = stateTree.root;
    assert.isTrue(safe, "off chain tx processing must be safe");

    const {serialized} = serialize(txs);

    const res = await C.processBatch(
      stateRoot0,
      serialized,
      senderProof,
      receiverProofs
    );
    assert.equal(0, res[1].toNumber());
    assert.equal(stateRoot1, res[0].toString());
  });
  it("Airdrop: signature check", async function() {
    // Save entry state root
    const stateRoot0 = stateTree.root;
    // Prapere some transactions
    const batchSize = 16;
    const amount = 2;
    let airdropAmount = amount * batchSize;
    const stx = new TxAirdropSender(
      helicopterAccount.accountID,
      helicopterAccount.stateID,
      initialNonce
    );
    const rtxs: TxAirdropReceiver[] = [];
    const txs: Tx[] = [stx];
    for (let i = 0; i < batchSize; i++) {
      const receiverAccount = accounts[(i + 5) % accountSize];
      const tx = new TxAirdropReceiver(receiverAccount.stateID, amount);
      rtxs.push(tx);
      txs.push(tx);
      airdropAmount += amount;
    }

    const {serialized, commit} = serialize(txs);
    const pubkey = helicopterAccount.encodePubkey();
    const witness = registry.witness(helicopterAccount.accountID);
    const signatureProof = {pubkey, witness};
    const signatureRaw = helicopterAccount.signMsg(serialized);
    const signature = mcl.g1ToHex(signatureRaw);
    const res = await C.signatureCheck(
      signature,
      signatureProof,
      helicopterAccount.accountID,
      commit
    );
    assert.equal(0, res.toNumber());
  });
});
