import * as utils from "../scripts/helpers/utils";
import * as walletHelper from "../scripts/helpers/wallet";
import {
    Usage,
    ErrorCode,
    CreateAccount,
    DropTx,
    Account,
    BurnConsentTx,
    BurnExecutionTx,
    Transaction,
    Wallet,
    GovConstants
} from "../scripts/helpers/interfaces";
import { PublicKeyStore, StateStore } from "../scripts/helpers/store";
import {
    coordinatorPubkeyHash,
    DummyAccountMP,
    DummyPDAMP,
    DummyECDSASignature
} from "../scripts/helpers/constants";
const RollupCore = artifacts.require("Rollup");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const RollupReddit = artifacts.require("RollupReddit");

contract("Reddit", async function() {
    let wallets: Wallet[];
    let Reddit: any;
    let User: any;
    let Bob: any;
    let testTokenInstance;
    let depositManagerInstance;
    let rollupCoreInstance: any;
    let rollupRedditInstance: any;
    let RollupUtilsInstance: any;
    let IMTInstance: any;
    let coordinator_leaves: string;
    let pubkeyStore: PublicKeyStore;
    let stateStore: StateStore;
    let govConstants: GovConstants;
    before(async function() {
        depositManagerInstance = await DepositManager.deployed();
        rollupCoreInstance = await RollupCore.deployed();
        rollupRedditInstance = await RollupReddit.deployed();
        IMTInstance = await IMT.deployed();
        RollupUtilsInstance = await RollupUtils.deployed();
        govConstants = await utils.getGovConstants();
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
        Reddit = {
            Wallet: wallets[0],
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 50,
            TokenType: 1,
            AccID: 2,
            Path: 2,
            nonce: 0
        };
        Bob = {
            Wallet: wallets[1],
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 1,
            TokenType: 1,
            AccID: 3,
            Path: 3,
            nonce: 0
        };
        User = {
            Wallet: wallets[2],
            Address: wallets[2].getAddressString(),
            Pubkey: wallets[2].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 4,
            Path: 4,
            nonce: 0
        };
        testTokenInstance = await utils.registerToken(wallets[0]);
        await testTokenInstance.transfer(Reddit.Address, 100);
        await depositManagerInstance.depositFor(
            Reddit.Address,
            Reddit.Amount,
            Reddit.TokenType,
            Reddit.Pubkey
        );
        await depositManagerInstance.depositFor(
            Bob.Address,
            Bob.Amount,
            Bob.TokenType,
            Bob.Pubkey
        );
        stateStore = new StateStore(govConstants.MAX_DEPTH);
        coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
        stateStore.insertHash(coordinator_leaves[0]);
        stateStore.insertHash(coordinator_leaves[1]);

        const subtreeDepth = 1;
        const position = stateStore.findEmptySubTreePosition(subtreeDepth);
        const subtreeIsEmptyProof = await stateStore.getSubTreeMerkleProof(
            position,
            subtreeDepth
        );

        await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            subtreeIsEmptyProof,
            { value: govConstants.STAKE_AMOUNT }
        );
        const RedditAccount: Account = {
            ID: Reddit.AccID,
            tokenType: Reddit.TokenType,
            balance: Reddit.Amount,
            nonce: Reddit.nonce,
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

        // Insert Reddit's and Bob's account after finaliseDepositsAndSubmitBatch
        await stateStore.insert(RedditAccount);
        await stateStore.insert(BobAccount);

        pubkeyStore = new PublicKeyStore(govConstants.MAX_DEPTH);
        pubkeyStore.insertHash(coordinatorPubkeyHash);
        pubkeyStore.insertHash(coordinatorPubkeyHash);
        pubkeyStore.insertPublicKey(Reddit.Pubkey);
        pubkeyStore.insertPublicKey(Bob.Pubkey);
    });
    it("Should Create Account for the User", async function() {
        // Call to see what's the pubkeyId
        const userPubkeyId = await rollupRedditInstance.createPublickeys.call([
            User.Pubkey
        ]);
        assert.equal(userPubkeyId.toString(), User.AccID);
        // Actual execution
        await rollupRedditInstance.createPublickeys([User.Pubkey]);
        const userPubkeyIdOffchain = await pubkeyStore.insertPublicKey(
            User.Pubkey
        );
        assert.equal(userPubkeyIdOffchain.toString(), userPubkeyId.toString());

        const userStateID = stateStore.nextEmptyIndex();
        const tx = {
            txType: Usage.CreateAccount,
            accountID: userPubkeyId,
            stateID: userStateID,
            tokenType: 1
        } as CreateAccount;
        const txBytes = await RollupUtilsInstance.BytesFromCreateAccountNoStruct(
            tx.txType,
            tx.accountID,
            tx.stateID,
            tx.tokenType
        );

        const newAccountMP = await stateStore.getAccountMerkleProof(
            userStateID,
            true
        );
        const result = await rollupRedditInstance.ApplyCreateAccountTx(
            newAccountMP,
            txBytes
        );
        const createdAccount = await utils.AccountFromBytes(result[0]);
        await stateStore.update(userStateID, createdAccount);

        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const userPDAProof = await pubkeyStore.getPDAMerkleProof(
            userPubkeyIdOffchain
        );

        const resultProcessTx = await rollupRedditInstance.processCreateAccountTx(
            balanceRoot,
            accountRoot,
            txBytes,
            userPDAProof,
            newAccountMP
        );
        const [newBalanceRoot, errorCode] = [
            resultProcessTx[0],
            resultProcessTx[2]
        ];
        assert.equal(ErrorCode.NoError, errorCode.toNumber());

        const compressedTxs = await RollupUtilsInstance.CompressManyCreateAccountFromEncoded(
            [txBytes]
        );
        await utils.submitBatch(
            compressedTxs,
            newBalanceRoot,
            Usage.CreateAccount
        );
        assert.equal(newBalanceRoot, await stateStore.getRoot());

        // Run disputeBatch with no fraud
        const accountProofs = [
            {
                from: DummyAccountMP,
                to: newAccountMP
            }
        ];
        await utils.disputeBatch(compressedTxs, accountProofs, [userPDAProof]);

        const batchMarker = await rollupCoreInstance.invalidBatchMarker();

        assert.equal(batchMarker, "0", "batchMarker should be zero");
    });

    it("Should Airdrop some token to the User", async function() {
        const redditMP = await stateStore.getAccountMerkleProof(Reddit.AccID);
        const tx = {
            txType: Usage.Airdrop,
            fromIndex: Reddit.AccID,
            toIndex: User.AccID,
            tokenType: 1,
            nonce: redditMP.accountIP.account.nonce + 1,
            amount: 10
        } as DropTx;

        const signBytes = await RollupUtilsInstance.AirdropSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.nonce,
            tx.amount
        );
        tx.signature = utils.sign(signBytes, Reddit.Wallet);
        const txBytes = await RollupUtilsInstance.BytesFromAirdropNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );

        const resultFrom = await rollupRedditInstance.ApplyAirdropTx(
            redditMP,
            txBytes
        );
        const redditUpdatedAccount: Account = await utils.AccountFromBytes(
            resultFrom[0]
        );
        await stateStore.update(Reddit.AccID, redditUpdatedAccount);

        const userMP = await stateStore.getAccountMerkleProof(User.AccID);
        const resultTo = await rollupRedditInstance.ApplyAirdropTx(
            userMP,
            txBytes
        );
        const userUpdatedAccount = await utils.AccountFromBytes(resultTo[0]);
        await stateStore.update(User.AccID, userUpdatedAccount);

        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const redditPDAProof = await pubkeyStore.getPDAMerkleProof(Reddit.Path);

        const resultProcessTx = await rollupRedditInstance.processAirdropTx(
            balanceRoot,
            accountRoot,
            tx.signature,
            txBytes,
            redditPDAProof,
            { from: redditMP, to: userMP }
        );
        const [newBalanceRoot, errorCode] = [
            resultProcessTx[0],
            resultProcessTx[3]
        ];
        assert.equal(errorCode, ErrorCode.NoError);
        assert.equal(newBalanceRoot, resultTo[1]);

        const resultBadSig = await rollupRedditInstance.processAirdropTx(
            balanceRoot,
            accountRoot,
            DummyECDSASignature,
            txBytes,
            redditPDAProof,
            { from: redditMP, to: userMP }
        );
        assert.equal(resultBadSig[3], ErrorCode.BadSignature);

        const compressedTxs = await RollupUtilsInstance.CompressManyAirdropFromEncoded(
            [txBytes],
            [tx.signature]
        );

        await utils.submitBatch(compressedTxs, newBalanceRoot, Usage.Airdrop);

        assert.equal(newBalanceRoot, await stateStore.getRoot());

        const accountProofs = [
            {
                from: redditMP,
                to: userMP
            }
        ];
        await utils.disputeBatch(compressedTxs, accountProofs, [
            redditPDAProof
        ]);

        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker should be zero");
    });

    it("let user transfer some token to Bob", async function() {
        const userMP = await stateStore.getAccountMerkleProof(User.AccID);
        const tx = {
            txType: Usage.Transfer,
            fromIndex: User.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            nonce: userMP.accountIP.account.nonce + 1,
            amount: 1
        } as Transaction;
        const signBytes = await RollupUtilsInstance.getTxSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.nonce,
            tx.amount
        );
        tx.signature = utils.sign(signBytes, User.Wallet);
        const txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );

        const resultFrom = await rollupRedditInstance.ApplyTransferTx(
            userMP,
            txBytes
        );
        const userUpdatedAccount = await utils.AccountFromBytes(resultFrom[0]);
        await stateStore.update(User.AccID, userUpdatedAccount);

        const bobMP = await stateStore.getAccountMerkleProof(Bob.AccID);
        const resultTo = await rollupRedditInstance.ApplyTransferTx(
            bobMP,
            txBytes
        );
        const bobUpdatedAccount = await utils.AccountFromBytes(resultTo[0]);
        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        await stateStore.update(Bob.AccID, bobUpdatedAccount);
        const userPDAProof = await pubkeyStore.getPDAMerkleProof(User.Path);

        const resultProcessTx = await rollupRedditInstance.processTransferTx(
            balanceRoot,
            accountRoot,
            tx.signature,
            txBytes,
            userPDAProof,
            { from: userMP, to: bobMP }
        );
        const [newBalanceRoot, errorCode] = [
            resultProcessTx[0],
            resultProcessTx[3]
        ];
        assert.equal(errorCode, ErrorCode.NoError);
        assert.equal(newBalanceRoot, resultTo[1]);

        const resultBadSig = await rollupRedditInstance.processTransferTx(
            balanceRoot,
            accountRoot,
            DummyECDSASignature,
            txBytes,
            userPDAProof,
            { from: userMP, to: bobMP }
        );
        assert.equal(resultBadSig[3], ErrorCode.BadSignature);

        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txBytes],
            [tx.signature]
        );

        await utils.submitBatch(compressedTxs, newBalanceRoot, Usage.Transfer);

        assert.equal(newBalanceRoot, await stateStore.getRoot());

        // Run disputeBatch with no fraud
        const accountProofs = [
            {
                from: userMP,
                to: bobMP
            }
        ];
        await utils.disputeBatch(compressedTxs, accountProofs, [userPDAProof]);

        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker should be zero");
    });
    it("lets user send burn consent", async function() {
        const userMP = await stateStore.getAccountMerkleProof(User.AccID);
        const tx = {
            txType: Usage.BurnConsent,
            fromIndex: User.AccID,
            amount: 5,
            nonce: userMP.accountIP.account.nonce + 1
        } as BurnConsentTx;
        const signBytes = await RollupUtilsInstance.BurnConsentSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.nonce,
            tx.amount
        );
        tx.signature = utils.sign(signBytes, User.Wallet);
        const txBytes = await RollupUtilsInstance.BytesFromBurnConsentNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.amount,
            tx.nonce
        );
        await RollupUtilsInstance.BurnConsentFromBytes(txBytes);

        const result = await rollupRedditInstance.ApplyBurnConsentTx(
            userMP,
            txBytes
        );
        const userUpdatedAccount = await utils.AccountFromBytes(result[0]);
        await stateStore.update(User.AccID, userUpdatedAccount);

        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const userPDAProof = await pubkeyStore.getPDAMerkleProof(User.Path);

        const resultProcessTx = await rollupRedditInstance.processBurnConsentTx(
            balanceRoot,
            accountRoot,
            tx.signature,
            txBytes,
            userPDAProof,
            userMP
        );
        const [newBalanceRoot, errorCode] = [
            resultProcessTx[0],
            resultProcessTx[2]
        ];
        assert.equal(errorCode, ErrorCode.NoError);
        assert.equal(newBalanceRoot, result[1]);

        const resultBadSig = await rollupRedditInstance.processBurnConsentTx(
            balanceRoot,
            accountRoot,
            DummyECDSASignature,
            txBytes,
            userPDAProof,
            userMP
        );
        assert.equal(resultBadSig[2], ErrorCode.BadSignature);

        const compressedTxs = await RollupUtilsInstance.CompressManyBurnConsentFromEncoded(
            [txBytes],
            [tx.signature]
        );

        await utils.submitBatch(
            compressedTxs,
            newBalanceRoot,
            Usage.BurnConsent
        );

        assert.equal(newBalanceRoot, await stateStore.getRoot());

        // Run disputeBatch with no fraud
        const accountProofs = [
            {
                from: userMP,
                to: DummyAccountMP
            }
        ];

        await utils.disputeBatch(compressedTxs, accountProofs, [userPDAProof]);

        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker should be zero");
    });
    it("lets Reddit to execute the burn", async function() {
        const userMP = await stateStore.getAccountMerkleProof(User.AccID);
        const tx: BurnExecutionTx = {
            txType: Usage.BurnExecution,
            fromIndex: User.AccID
        };
        const txBytes = await RollupUtilsInstance.BytesFromBurnExecutionNoStruct(
            tx.txType,
            tx.fromIndex
        );
        await RollupUtilsInstance.BurnExecutionFromBytes(txBytes);

        const result = await rollupRedditInstance.ApplyBurnExecutionTx(userMP);
        const userUpdatedAccount = await utils.AccountFromBytes(result[0]);
        await stateStore.update(User.AccID, userUpdatedAccount);

        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();

        const resultProcessTx = await rollupRedditInstance.processBurnExecutionTx(
            balanceRoot,
            txBytes,
            userMP
        );
        const [newBalanceRoot, errorCode] = [
            resultProcessTx[0],
            resultProcessTx[2]
        ];
        assert.equal(errorCode, ErrorCode.NoError, "processTx returns error");
        assert.equal(newBalanceRoot, result[1], "mismatch balance root");

        const compressedTxs = await RollupUtilsInstance.CompressManyBurnExecutionFromEncoded(
            [txBytes]
        );
        await utils.submitBatch(
            compressedTxs,
            newBalanceRoot,
            Usage.BurnExecution
        );

        assert.equal(newBalanceRoot, await stateStore.getRoot());

        // Run disputeBatch with no fraud
        const accountProofs = [
            {
                from: userMP,
                to: DummyAccountMP
            }
        ];
        await utils.disputeBatch(compressedTxs, accountProofs, [DummyPDAMP]);

        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker should be zero");
    });
    it("bench rollup CreateAccount", async function() {
        const numTx = govConstants.MAX_TXS_PER_BATCH;
        const tx: CreateAccount = {
            txType: Usage.CreateAccount,
            accountID: 1,
            stateID: 1,
            tokenType: 1
        };

        const txBytes = await RollupUtilsInstance.BytesFromCreateAccountNoStruct(
            tx.txType,
            tx.accountID,
            tx.stateID,
            tx.tokenType
        );

        const compressedTxs = await RollupUtilsInstance.CompressManyCreateAccountFromEncoded(
            Array(numTx).fill(txBytes)
        );

        await utils.logEstimate(compressedTxs, Usage.CreateAccount);
    });

    it("bench rollup Airdrop", async function() {
        const numTx = govConstants.MAX_TXS_PER_BATCH;
        const tx: DropTx = {
            txType: Usage.Airdrop,
            fromIndex: 1,
            toIndex: 1,
            tokenType: 1,
            nonce: 1,
            amount: 10,
            signature: DummyECDSASignature
        };
        const txBytes = await RollupUtilsInstance.BytesFromAirdropNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );

        const compressedTxs = await RollupUtilsInstance.CompressManyAirdropFromEncoded(
            Array(numTx).fill(txBytes),
            Array(numTx).fill(DummyECDSASignature)
        );

        await utils.logEstimate(compressedTxs, Usage.Airdrop);
    });
    it("bench rollup Transfer", async function() {
        const numTx = govConstants.MAX_TXS_PER_BATCH;
        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: 1,
            toIndex: 1,
            tokenType: 1,
            nonce: 1,
            amount: 10,
            signature: DummyECDSASignature
        };
        const txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );

        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            Array(numTx).fill(txBytes),
            Array(numTx).fill(DummyECDSASignature)
        );

        await utils.logEstimate(compressedTxs, Usage.Transfer);
    });
    it("bench rollup BurnConsent", async function() {
        const numTx = govConstants.MAX_TXS_PER_BATCH;
        const tx: BurnConsentTx = {
            txType: Usage.BurnConsent,
            fromIndex: 1,
            nonce: 1,
            amount: 10,
            signature: DummyECDSASignature
        };
        const txBytes = await RollupUtilsInstance.BytesFromBurnConsentNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.amount,
            tx.nonce
        );

        const compressedTxs = await RollupUtilsInstance.CompressManyBurnConsentFromEncoded(
            Array(numTx).fill(txBytes),
            Array(numTx).fill(DummyECDSASignature)
        );

        await utils.logEstimate(compressedTxs, Usage.BurnConsent);
    });
    it("bench rollup BurnExecution", async function() {
        const numTx = govConstants.MAX_TXS_PER_BATCH;
        const tx: BurnExecutionTx = {
            txType: Usage.BurnExecution,
            fromIndex: 1
        };
        const txBytes = await RollupUtilsInstance.BytesFromBurnExecutionNoStruct(
            tx.txType,
            tx.fromIndex
        );

        const compressedTxs = await RollupUtilsInstance.CompressManyBurnExecutionFromEncoded(
            Array(numTx).fill(txBytes)
        );

        await utils.logEstimate(compressedTxs, Usage.BurnExecution);
    });
});
