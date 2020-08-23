const RollupUtilsLib = artifacts.require("RollupUtils");
const TransferRollup = artifacts.require("TestTransfer");
const Rollup = artifacts.require("Rollup");
const loggerContract = artifacts.require("Logger");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");

const BLSAccountRegistry = artifacts.require("BLSAccountRegistry");
import { TxTransfer, serialize, calculateRoot, Tx } from "./utils/tx";
import * as mcl from "./utils/mcl";
import { StateTree } from "./utils/state_tree";
import { AccountRegistry } from "./utils/account_tree";
import { Account } from "./utils/state_account";
import { TestTransferInstance } from "../types/truffle-contracts";

let appID =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
let ACCOUNT_SIZE = 32;
let BATCH_SIZE = 32;
let STATE_TREE_DEPTH = 32;

function link(contract: any, instance: any) {
    contract.link(instance);
}

describe("Rollup Transfer Commitment", () => {
    let rollup: TestTransferInstance;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    const accounts: Account[] = [];
    const tokenID = 1;
    const initialBalance = 1000;
    const initialNonce = 9;

    before(async function() {
        await mcl.init();
        const logger = await loggerContract.new();
        const registryContract = await BLSAccountRegistry.new(logger.address);
        registry = await AccountRegistry.new(registryContract);
        for (let i = 0; i < ACCOUNT_SIZE; i++) {
            const accountID = i;
            const stateID = i;
            const account = Account.new(
                appID,
                accountID,
                tokenID,
                initialBalance,
                initialNonce + i
            );
            account.setStateID(stateID);
            account.newKeyPair();
            accounts.push(account);
            await registry.register(account.encodePubkey());
        }
    });

    beforeEach(async function() {
        let rollupUtilsLib = await RollupUtilsLib.new();
        const merkleTreeUtils = await MerkleTreeUtils.new(STATE_TREE_DEPTH);
        link(TransferRollup, rollupUtilsLib);
        rollup = await TransferRollup.new(merkleTreeUtils.address);
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        for (let i = 0; i < ACCOUNT_SIZE; i++) {
            stateTree.createAccount(accounts[i]);
        }
    });

    it("transfer commitment: signature check", async function() {
        const txs: TxTransfer[] = [];
        const amount = 20;
        let aggSignature = mcl.newG1();
        let s0 = stateTree.root;
        let signers = [];
        const pubkeys = [];
        const pubkeyWitnesses = [];
        for (let i = 0; i < BATCH_SIZE; i++) {
            const senderIndex = i;
            const reciverIndex = (i + 5) % ACCOUNT_SIZE;
            const sender = accounts[senderIndex];
            const receiver = accounts[reciverIndex];
            const tx = new TxTransfer(
                sender.stateID,
                receiver.stateID,
                amount,
                sender.nonce
            );
            txs.push(tx);
            signers.push(sender);
            pubkeys.push(sender.encodePubkey());
            pubkeyWitnesses.push(registry.witness(sender.accountID));
            const signature = sender.sign(tx);
            aggSignature = mcl.aggreagate(aggSignature, signature);
        }
        let signature = mcl.g1ToHex(aggSignature);
        let stateTransitionProof = stateTree.applyTransferBatch(txs);
        assert.isTrue(stateTransitionProof.safe);
        const { serialized, commit } = serialize(txs);
        const stateWitnesses = [];
        const stateAccounts = [];
        for (let i = 0; i < BATCH_SIZE; i++) {
            stateWitnesses.push(
                stateTree.getAccountWitness(signers[i].stateID)
            );
            stateAccounts.push(signers[i].toSolStruct());
        }
        const postStateRoot = stateTree.root;
        const accountRoot = registry.root();
        const proof = {
            stateAccounts,
            stateWitnesses,
            pubkeys,
            pubkeyWitnesses
        };
        const res = await rollup.checkSignature.call(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            appID,
            serialized
        );
        assert.equal(0, res[0].toNumber());
        console.log("operation gas cost:", res[1].toString());
        const tx = await rollup.checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            appID,
            serialized
        );
        console.log("transaction gas cost:", tx.receipt.gasUsed);
    }).timeout(100000);

    it("transfer applyTx", async function() {
        const amount = 20;
        for (let i = 0; i < BATCH_SIZE; i++) {
            const senderIndex = i;
            const reciverIndex = (i + 5) % ACCOUNT_SIZE;
            const sender = accounts[senderIndex];
            const receiver = accounts[reciverIndex];
            const tx = new TxTransfer(
                sender.stateID,
                receiver.stateID,
                amount,
                sender.nonce
            );
            const pubkeyWitness = registry.witness(sender.accountID);
            const preRoot = stateTree.root;
            const proof = stateTree.applyTxTransfer(tx);
            const postRoot = stateTree.root;
            const { serialized } = serialize([tx]);

            const result = await rollup.testProcessTx(
                preRoot,
                serialized,
                0,
                {
                    siblings: pubkeyWitness,
                    _pda: {
                        pathToPubkey: sender.accountID,
                        pubkey_leaf: { pubkey: sender.encodePubkey() }
                    }
                },
                {
                    from: {
                        accountIP: {
                            pathToAccount: sender.stateID,
                            account: proof.senderAccount
                        },
                        siblings: proof.senderWitness
                    },
                    to: {
                        accountIP: {
                            pathToAccount: receiver.stateID,
                            account: proof.receiverAccount
                        },
                        siblings: proof.receiverWitness
                    }
                }
            );
            assert.equal(result[0], postRoot, "mismatch processed stateroot");
        }
    });
});
