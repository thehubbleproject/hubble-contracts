import * as utils from "../scripts/helpers/utils";
import * as walletHelper from "../scripts/helpers/wallet";
import {
    Transaction,
    ErrorCode,
    Usage,
    Account,
    Wallet,
    PDAMerkleProof
} from "../scripts/helpers/interfaces";
import {
    StakingAmountString,
    coordinatorPubkeyHash
} from "../scripts/helpers/constants";
import { PublicKeyStore, StateStore } from "../scripts/helpers/store";
import { MAX_DEPTH } from "../scripts/helpers/constants";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const RollupUtils = artifacts.require("RollupUtils");

contract("Rollup", async function(accounts) {
    let wallets: Wallet[];

    let depositManagerInstance: any;
    let testTokenInstance: any;
    let rollupCoreInstance: any;
    let RollupUtilsInstance: any;
    let tokenRegistryInstance: any;

    let Alice: any;
    let Bob: any;

    let coordinator_leaves: any;
    let alicePDAProof: PDAMerkleProof;

    let falseBatchComb: any;

    let pubkeyStore: PublicKeyStore;
    let stateStore: StateStore;

    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
        depositManagerInstance = await DepositManager.deployed();
        testTokenInstance = await TestToken.deployed();
        rollupCoreInstance = await RollupCore.deployed();
        RollupUtilsInstance = await RollupUtils.deployed();
        tokenRegistryInstance = await utils.getTokenRegistry();

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

        stateStore = new StateStore(MAX_DEPTH);
        stateStore.insertHash(coordinator_leaves[0]);
        stateStore.insertHash(coordinator_leaves[1]);

        pubkeyStore = new PublicKeyStore(MAX_DEPTH);
        pubkeyStore.insertHash(coordinatorPubkeyHash);
        pubkeyStore.insertHash(coordinatorPubkeyHash);
        const AliceKeyIndex = await pubkeyStore.insertPublicKey(Alice.Pubkey);
        await pubkeyStore.insertPublicKey(Bob.Pubkey);
        alicePDAProof = await pubkeyStore.getPDAMerkleProof(AliceKeyIndex);
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
        const tx = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 1,
            nonce: 1
        } as Transaction;

        tx.signature = await utils.signTx(tx, wallets[0]);

        const { accountProofs } = await utils.processTransferTxOffchain(
            stateStore,
            tx
        );

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            tx,
            alicePDAProof,
            accountProofs
        );

        await utils.compressAndSubmitBatch(tx, result.newStateRoot);
        const batchIdPre = await utils.getBatchId();

        await utils.disputeTransferBatch(
            [tx],
            [accountProofs],
            [alicePDAProof]
        );

        const batchIdPost = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(batchIdPost, batchIdPre, "dispute shouldnt happen");
    });

    it("submit new batch 2nd(False Batch)", async function() {
        const tx = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        } as Transaction;
        tx.signature = await utils.signTx(tx, wallets[0]);

        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            tx,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "False error code."
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);

        const batchIdPre = await utils.getBatchId();

        await utils.disputeTransferBatch(
            [tx],
            [accountProofs],
            [alicePDAProof]
        );

        const batchIdPost = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(batchIdPost, batchIdPre - 1, "mismatch batchId");
    });

    it("submit new batch 3rd", async function() {
        const tx = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 0, // Error
            nonce: 2
        } as Transaction;
        tx.signature = await utils.signTx(tx, wallets[0]);

        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            tx,
            alicePDAProof,
            accountProofs
        );
        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "false Error Code"
        );

        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const batchIdPre = await utils.getBatchId();

        await utils.disputeTransferBatch(
            [tx],
            [accountProofs],
            [alicePDAProof]
        );

        const batchIdPost = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(batchIdPost, batchIdPre - 1, "mismatch batchId");
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
        const tx = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        } as Transaction;

        tx.signature = await utils.signTx(tx, wallets[0]);
        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            tx,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "False ErrorId."
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const batchIdPre = await utils.getBatchId();

        await utils.disputeTransferBatch(
            [tx],
            [accountProofs],
            [alicePDAProof]
        );

        const batchIdPost = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(batchIdPost, batchIdPre - 1, "mismatch batchId");
    });

    it("submit new batch 6nd(False Batch)", async function() {
        const tx = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        } as Transaction;
        tx.signature = await utils.signTx(tx, wallets[0]);
        stateStore.setCheckpoint();
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            tx,
            alicePDAProof,
            accountProofs
        );

        assert.equal(
            result.error,
            ErrorCode.InvalidTokenAmount,
            "Wrong ErrorId"
        );
        await utils.compressAndSubmitBatch(tx, newStateRoot);
        const batchId = await utils.getBatchId();

        falseBatchComb = {
            batchId,
            txs: [tx],
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });

    it("submit new batch 7th(false batch)", async function() {
        const aliceState = stateStore.items[Alice.Path];
        const tx = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 0, // An invalid amount
            nonce: aliceState.data!.nonce + 1
        } as Transaction;
        tx.signature = await utils.signTx(tx, wallets[0]);
        const {
            accountProofs,
            newStateRoot
        } = await utils.processTransferTxOffchain(stateStore, tx);
        stateStore.restoreCheckpoint();

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            tx,
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
        await utils.disputeTransferBatch(
            falseBatchComb.txs,
            falseBatchComb.batchProofs.accountProofs,
            falseBatchComb.batchProofs.pdaProof,
            falseBatchComb.batchId
        );

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
