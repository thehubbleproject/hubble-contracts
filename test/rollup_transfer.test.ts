import { LoggerFactory } from "../types/ethers-contracts/LoggerFactory";
import { RollupUtilsFactory } from "../types/ethers-contracts/RollupUtilsFactory";
import { TestTransferFactory } from "../types/ethers-contracts/TestTransferFactory";
import { TestTransfer } from "../types/ethers-contracts/TestTransfer";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { TxTransfer, serialize, calculateRoot, Tx } from "./utils/tx";
import * as mcl from "./utils/mcl";
import { StateTree } from "./utils/state_tree";
import { AccountRegistry } from "./utils/account_tree";
import { Account } from "./utils/state_account";
import { assert } from "chai";
import { ethers } from "@nomiclabs/buidler";
import { ErrorCode } from "../scripts/helpers/interfaces";
import { parseEvents } from "../ts/utils";

let appID =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
let ACCOUNT_SIZE = 32;
let BATCH_SIZE = 32;
let STATE_TREE_DEPTH = 32;

describe("Rollup Transfer Commitment", () => {
    let rollup: TestTransfer;
    let registry: AccountRegistry;
    let stateTree: StateTree;
    const accounts: Account[] = [];
    const tokenID = 1;
    const initialBalance = 1000;
    const initialNonce = 9;

    before(async function() {
        await mcl.init();
        const [signer, ...rest] = await ethers.getSigners();
        const logger = await new LoggerFactory(signer).deploy();
        const registryContract = await new BlsAccountRegistryFactory(
            signer
        ).deploy(logger.address);

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
        const [signer, ...rest] = await ethers.getSigners();
        let rollupUtilsLib = await new RollupUtilsFactory(signer).deploy();
        rollup = await new TestTransferFactory(
            {
                __$a6b8846b3184b62d6aec39d1f36e30dab3$__: rollupUtilsLib.address
            },
            signer
        ).deploy();
        stateTree = StateTree.new(STATE_TREE_DEPTH);
        for (let i = 0; i < ACCOUNT_SIZE; i++) {
            stateTree.createAccount(accounts[i]);
        }
    });

    it("transfer commitment: signature check", async function() {
        const txs: TxTransfer[] = [];
        const amount = 20;
        const fee = 1;
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
                fee,
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
        const tx = await rollup._checkSignature(
            signature,
            proof,
            postStateRoot,
            accountRoot,
            appID,
            serialized
        );
        const receipt = await tx.wait();
        const events = parseEvents(receipt);
        assert.equal(
            events.Return2[0],
            ErrorCode.NoError,
            `Getting Error for signature check: ${ErrorCode[events.Return2[0]]}`
        );
        console.log("operation gas cost:", events.Return1[0].toNumber());
        console.log("transaction gas cost:", receipt.gasUsed?.toNumber());
    }).timeout(400000);

    it("transfer applyTx", async function() {
        const amount = 20;
        const fee = 1;
        for (let i = 0; i < BATCH_SIZE; i++) {
            const senderIndex = i;
            const reciverIndex = (i + 5) % ACCOUNT_SIZE;
            const sender = accounts[senderIndex];
            const receiver = accounts[reciverIndex];
            const tx = new TxTransfer(
                sender.stateID,
                receiver.stateID,
                amount,
                fee,
                sender.nonce
            );
            const pubkeyWitness = registry.witness(sender.accountID);
            const preRoot = stateTree.root;
            const proof = stateTree.applyTxTransfer(tx);
            const postRoot = stateTree.root;

            const result = await rollup.testProcessTx(preRoot, tx.extended(), {
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
            });
            assert.equal(result[0], postRoot, "mismatch processed stateroot");
        }
    });
});
