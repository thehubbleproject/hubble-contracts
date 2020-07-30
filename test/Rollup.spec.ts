import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import {
    Transaction,
    ErrorCode,
    Usage,
    Account,
    Wallet,
    Dispute
} from "../scripts/helpers/interfaces";
import { StakingAmountString } from "../scripts/helpers/constants";
import { PublicKeyStore, StateStore } from "../scripts/helpers/store";
import { MAX_DEPTH } from "../scripts/helpers/constants";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const RollupReddit = artifacts.require("RollupReddit");

contract("Rollup", async function(accounts) {
    let wallets: Wallet[];

    let depositManagerInstance: any;
    let testTokenInstance: any;
    let rollupCoreInstance: any;
    let MTutilsInstance: any;
    let RollupUtilsInstance: any;
    let tokenRegistryInstance: any;
    let IMTInstance: any;
    let RollupRedditInstance: any;

    let Alice: any;
    let Bob: any;

    let coordinator_leaves: any;
    let coordinatorPubkeyHash: any;
    var zeroHashes: any;

    let falseBatchZero: Dispute;
    let falseBatchOne: any;
    let falseBatchTwo: any;
    let falseBatchThree: any;
    let falseBatchFour: any;
    let falseBatchFive: any;
    let falseBatchComb: any;

    let AlicePDAsiblings: any;

    let BobPDAsiblings: any;

    let alicePDAProof: any;
    let pubkeyStore: PublicKeyStore;
    let stateStore: StateStore;

    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
        depositManagerInstance = await DepositManager.deployed();
        testTokenInstance = await TestToken.deployed();
        rollupCoreInstance = await RollupCore.deployed();
        MTutilsInstance = await utils.getMerkleTreeUtils();
        RollupUtilsInstance = await RollupUtils.deployed();
        tokenRegistryInstance = await utils.getTokenRegistry();
        IMTInstance = await IMT.deployed();
        RollupRedditInstance = await RollupReddit.deployed();

        Alice = {
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 2,
            Path: "2",
            nonce: 0
        };
        Bob = {
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 3,
            Path: "3",
            nonce: 0
        };

        coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
        coordinatorPubkeyHash =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
        zeroHashes = await utils.defaultHashes(MAX_DEPTH);

        stateStore = new StateStore(MAX_DEPTH);
        stateStore.insertHash(coordinator_leaves[0]);
        stateStore.insertHash(coordinator_leaves[1]);

        pubkeyStore = new PublicKeyStore(MAX_DEPTH);
        pubkeyStore.insertHash(coordinator_leaves[0]);
        pubkeyStore.insertHash(coordinator_leaves[1]);
        pubkeyStore.insertPublicKey(Alice.Pubkey);
        pubkeyStore.insertPublicKey(Bob.Pubkey);

        AlicePDAsiblings = [
            utils.PubKeyHash(Bob.Pubkey),
            utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
            zeroHashes[2],
            zeroHashes[3]
        ];

        BobPDAsiblings = [
            utils.PubKeyHash(Alice.Pubkey),
            utils.getParentLeaf(
                coordinatorPubkeyHash,
                utils.PubKeyHash(Alice.Pubkey)
            ),
            zeroHashes[2],
            zeroHashes[3]
        ];

        alicePDAProof = {
            _pda: {
                pathToPubkey: "2",
                pubkey_leaf: { pubkey: Alice.Pubkey }
            },
            siblings: AlicePDAsiblings
        };
    });

    // test if we are able to create append a leaf
    it("make a deposit of 2 accounts", async function() {
        await utils.registerToken(wallets[0]);

        await testTokenInstance.transfer(Alice.Address, 100);
        await depositManagerInstance.deposit(
            Alice.Amount,
            Alice.TokenType,
            Alice.Pubkey
        );
        await depositManagerInstance.depositFor(
            Bob.Address,
            Bob.Amount,
            Bob.TokenType,
            Bob.Pubkey
        );

        const subtreeDepth = 1;
        const _zero_account_mp = await stateStore.getSubTreeMerkleProof(
            "001",
            subtreeDepth
        );

        await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            _zero_account_mp,
            { value: StakingAmountString }
        );
        const AliceAccount: Account = {
            ID: Alice.AccID,
            tokenType: Alice.TokenType,
            balance: Alice.Amount,
            nonce: Alice.nonce,
            burn: 0,
            lastBurn: 0
        };
        const BobAccount: Account = {
            ID: Bob.AccID,
            tokenType: Bob.TokenType,
            balance: Bob.Amount,
            nonce: Bob.nonce,
            burn: 0,
            lastBurn: 0
        };

        // Insert after finaliseDepositsAndSubmitBatch
        await stateStore.insert(AliceAccount);
        await stateStore.insert(BobAccount);
    });

    it("submit new batch 1st", async function() {
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 1,
            nonce: 1
        };

        tx.signature = await utils.signTx(tx, wallets[0]);
        const txByte = await utils.TxToBytes(tx);

        const { accountProofs } = await utils.processTransferTxOffchain(
            stateStore,
            tx
        );

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        await utils.compressAndSubmitBatch(tx, result.newStateRoot);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );
        const batchId = await utils.getBatchId();

        falseBatchZero = {
            batchId,
            txs: compressedTxs,
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });

    it("dispute batch correct 1th batch(no error)", async function() {
        await utils.disputeBatch(falseBatchZero);

        const batchId = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId,
            falseBatchZero.batchId,
            "dispute shouldnt happen"
        );
    });

    it("submit new batch 2nd(False Batch)", async function() {
        // prepare data for process Tx
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        };
        tx.signature = await utils.signTx(tx, wallets[0]);

        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        const txByte = await utils.TxToBytes(tx);
        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "False error code."
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );
        const batchId = await utils.getBatchId();

        falseBatchOne = {
            batchId,
            txs: compressedTxs,
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });
    it("dispute batch false 2nd batch", async function() {
        await utils.disputeBatch(falseBatchOne);

        const batchId = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "invalidBatchMarker is not zero");
        assert.equal(
            batchId,
            falseBatchOne.batchId - 1,
            "batchId doesnt match"
        );
    });

    it("submit new batch 3rd", async function() {
        // prepare data for process Tx
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 0, // Error
            nonce: 2
        };
        tx.signature = await utils.signTx(tx, wallets[0]);

        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );
        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "false Error Code"
        );

        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );
        const batchId = await utils.getBatchId();

        falseBatchTwo = {
            batchId,
            txs: compressedTxs,
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });

    it("dispute batch false 3rd batch(Tx amount 0)", async function() {
        await utils.disputeBatch(falseBatchTwo);

        const batchId = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId,
            falseBatchTwo.batchId - 1,
            "batchId doesnt match"
        );
    });

    it("Registring new token", async function() {
        await TestToken.new().then(async (instance: any) => {
            let testToken2Instance = instance;
            await tokenRegistryInstance.requestTokenRegistration(
                testToken2Instance.address,
                {
                    from: wallets[0].getAddressString()
                }
            );
            await tokenRegistryInstance.finaliseTokenRegistration(
                testToken2Instance.address,
                {
                    from: wallets[0].getAddressString()
                }
            );
        });
        await tokenRegistryInstance.registeredTokens(2);
        // TODO
    });

    it("submit new batch 5nd", async function() {
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        };

        tx.signature = await utils.signTx(tx, wallets[0]);
        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "False ErrorId."
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );
        const batchId = await utils.getBatchId();

        falseBatchFive = {
            batchId,
            txs: compressedTxs,
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });
    it("dispute batch false 5th batch", async function() {
        await utils.disputeBatch(falseBatchFive);

        const batchId = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId,
            falseBatchFive.batchId - 1,
            "batchId doesnt match"
        );
    });

    it("submit new batch 6nd(False Batch)", async function() {
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        };
        tx.signature = await utils.signTx(tx, wallets[0]);
        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "Wrong ErrorId"
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );
        const batchId = await utils.getBatchId();

        falseBatchComb = {
            batchId,
            txs: compressedTxs,
            signatures: [tx.signature],
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });

    it("submit new batch 7th(false batch)", async function() {
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const aliceState = stateStore.items[Alice.Path];
        console.log("currentRoot", currentRoot, await stateStore.getRoot());

        console.log("aliceState", aliceState);
        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 0, // An invalid amount
            nonce: aliceState.data!.nonce + 1
        };
        tx.signature = await utils.signTx(tx, wallets[0]);
        console.log("tx", tx);
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        const txByte = await utils.TxToBytes(tx);
        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "false Error Code"
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);
    });

    it("dispute batch false Combo batch", async function() {
        await utils.disputeBatch(falseBatchComb);

        const batchId = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId,
            falseBatchComb.batchId - 1,
            "batchId doesnt match"
        );
    });
});
