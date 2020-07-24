const TestCreateAccountRollup = artifacts.require("TestCreateAccountRollup");
const BLSAccountRegistry = artifacts.require("BLSAccountRegistry");
const RollupUtilsLib = artifacts.require("RollupUtils");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
import {TestCreateAccountRollupInstance} from "../types/truffle-contracts";
import {serialize, calculateRoot, TxCreate} from "./utils/tx";
import * as mcl from "./utils/mcl";
import {StateTree} from "./utils/state_tree";
import {Account} from "./utils/state_account";
import {AccountRegistry} from "./utils/account_tree";

const STATE_TREE_DEPTH: number = 32;

contract("Rollup create", eth_accounts => {
  let C: TestCreateAccountRollupInstance;
  let registry: AccountRegistry;
  let stateTree: StateTree;
  const accounts: Account[] = [];
  const tokenID = 1;
  const STAKE = web3.utils.toWei("1", "gwei");

  before(async function() {
    await mcl.init();
    const merkleTreeUtils = await MerkleTreeUtils.new();
    let rollupUtilsLib = await RollupUtilsLib.new();
    await TestCreateAccountRollup.link("RollupUtils", rollupUtilsLib.address);
    C = await TestCreateAccountRollup.new(merkleTreeUtils.address);
  });

  it("Crate: process state transition", async function() {
    const newAccountSize = 1;
    stateTree = StateTree.new(STATE_TREE_DEPTH);
    const stateRoot0 = stateTree.root;
    // create accounts
    const txs: TxCreate[] = [];

    for (let i = 0; i < newAccountSize; i++) {
      const accountID = i;
      const stateID = i + 1000;
      const newAccount = Account.new(accountID, tokenID, 0, 0)
        .setStateID(stateID)
        .newKeyPair();
      accounts.push(newAccount);
      const tx = new TxCreate(
        accounts[i].accountID,
        accounts[i].stateID,
        tokenID
      );
      txs.push(tx);
    }
    const {proof, safe} = stateTree.applyCreateBatch(txs);
    assert.isTrue(safe);
    const stateRoot10 = stateTree.root;

    const {serialized} = serialize(txs);

    console.log(serialized);
    console.log(proof);

    // Should be equal to local root
    const res = await C.processBatch(stateRoot0, serialized, proof);
    const fraudCode = res[1];
    const stateRoot11 = res[0];
    assert.equal(stateRoot10, stateRoot11);
    assert.equal(0, fraudCode.toNumber());
  });
});
