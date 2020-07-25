const TestBurnExecRollup = artifacts.require("TestBurnExecRollup");
const RollupUtilsLib = artifacts.require("RollupUtils");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
import {
  TestBurnExecRollupInstance,
  RollupUtilsInstance
} from "../types/truffle-contracts";
import {serialize, calculateRoot, TxCreate, TxBurnExecution} from "./utils/tx";
import * as mcl from "./utils/mcl";
import {StateTree} from "./utils/state_tree";
import {Account} from "./utils/state_account";
import {AccountRegistry} from "./utils/account_tree";

const STATE_TREE_DEPTH: number = 32;

contract("Burn Execution", eth_accounts => {
  let C: TestBurnExecRollupInstance;
  let rollupUtilsLib: RollupUtilsInstance;
  let registry: AccountRegistry;
  let stateTree: StateTree;
  const accounts: Account[] = [];
  const tokenID = 1;
  const accountSize = 16;
  const STAKE = web3.utils.toWei("1", "gwei");
  const initialBalance = 1000;
  const initialBurnConcent = 50;
  const initialNonce = 10;

  before(async function() {
    const merkleTreeUtils = await MerkleTreeUtils.new();
    rollupUtilsLib = await RollupUtilsLib.new();
    await TestBurnExecRollup.link("RollupUtils", rollupUtilsLib.address);
    C = await TestBurnExecRollup.new(merkleTreeUtils.address);
    stateTree = StateTree.new(STATE_TREE_DEPTH);
    // create accounts
    for (let i = 0; i < accountSize; i++) {
      const accountID = i;
      const stateID = i + 1000;
      const account = Account.new(
        accountID,
        tokenID,
        initialBalance,
        initialNonce,
        initialBurnConcent
      ).setStateID(stateID);
      accounts.push(account);
    }
  });
  beforeEach(async function() {
    stateTree = StateTree.new(STATE_TREE_DEPTH);
    for (let i = 0; i < accountSize; i++) {
      stateTree.createAccount(accounts[i]);
    }
  });
  it("Burn Execution: process state transition", async function() {
    // Save entry state root
    const stateRoot0 = stateTree.root;
    const txs: TxBurnExecution[] = [];
    for (let i = 0; i < accountSize; i++) {
      const account = accounts[i % accountSize];
      const tx = new TxBurnExecution(account.stateID);
      txs.push(tx);
    }

    const updateDate = (await rollupUtilsLib.GetYearMonth()).toNumber();
    // Apply it to the local state
    const {proof, safe} = stateTree.applyBurnExecutionBatch(txs, updateDate);
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
});
