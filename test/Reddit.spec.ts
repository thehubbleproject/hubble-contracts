import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import { ErrorCode, CreateAccount, DropTx, Account } from "../scripts/helpers/interfaces";
import { PublicKeyStore, AccountStore } from '../scripts/helpers/store';
import { coordinatorPubkeyHash, MAX_DEPTH } from '../scripts/helpers/constants';
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const EcVerify = artifacts.require("ECVerify");
const createAccount = artifacts.require("CreateAccount");
const RollupReddit = artifacts.require("RollupReddit");


contract("Reddit", async function () {
    let wallets: any;
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
    let accountStore: AccountStore;
    before(async function () {
        depositManagerInstance = await DepositManager.deployed();
        rollupCoreInstance = await RollupCore.deployed();
        rollupRedditInstance = await RollupReddit.deployed();
        IMTInstance = await IMT.deployed();
        RollupUtilsInstance = await RollupUtils.deployed();
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
        Reddit = {
            Wallet: wallets[0],
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 50,
            TokenType: 1,
            AccID: 2,
            Path: 2,
            nonce: 0,
        };
        Bob = {
            Wallet: wallets[1],
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 1,
            TokenType: 1,
            AccID: 3,
            Path: 3,
            nonce: 0,
        };
        User = {
            Wallet: wallets[2],
            Address: wallets[2].getAddressString(),
            Pubkey: wallets[2].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 4,
            Path: 4,
            nonce: 0,
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
        accountStore = new AccountStore(MAX_DEPTH);
        coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
        accountStore.insertHash(coordinator_leaves[0]);
        accountStore.insertHash(coordinator_leaves[1]);

        const subtreeDepth = 1
        const _zero_account_mp = await accountStore.getSubTreeMerkleProof("001", subtreeDepth);

        await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            _zero_account_mp,
            { value: ethers.utils.parseEther("32").toString() }
        );
        const RedditAccount: Account = {
            ID: Reddit.AccID,
            tokenType: Reddit.TokenType,
            balance: Reddit.Amount,
            nonce: Reddit.nonce,
            burn: 0,
            lastBurn: 0,
        };

        // Insert Reddit's and Bob's account after finaliseDepositsAndSubmitBatch
        await accountStore.insert(RedditAccount);
        accountStore.insertHash(await utils.createLeaf(Bob));

        pubkeyStore = new PublicKeyStore(MAX_DEPTH);
        pubkeyStore.insertHash(coordinatorPubkeyHash);
        pubkeyStore.insertHash(coordinatorPubkeyHash);
        pubkeyStore.insertPublicKey(Reddit.Pubkey);
        pubkeyStore.insertPublicKey(Bob.Pubkey);

    })
    it("Should Create Account for the User", async function () {
        const createAccountInstance = await createAccount.deployed();
        // Call to see what's the pubkeyId
        const userPubkeyId = await createAccountInstance.createPublickeys.call([User.Pubkey]);
        assert.equal(userPubkeyId.toString(), User.AccID);
        // Actual execution
        await createAccountInstance.createPublickeys([User.Pubkey]);
        const userPubkeyIdOffchain = await pubkeyStore.insertPublicKey(User.Pubkey);
        assert.equal(userPubkeyIdOffchain.toString(), userPubkeyId.toString());

        const userAccountID = accountStore.nextEmptyIndex();
        const tx = {
            toIndex: userAccountID,
            tokenType: 1
        } as CreateAccount;
        const signBytes = await RollupUtilsInstance.getCreateAccountSignBytes(tx.toIndex, tx.tokenType);
        tx.signature = utils.sign(signBytes, Reddit.Wallet);

        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const NewAccountMP = await accountStore.getAccountMerkleProof(userAccountID, true);
        const userPDAProof = await pubkeyStore.getPDAMerkleProof(userPubkeyIdOffchain);

        const result = await createAccountInstance.processTx(
            balanceRoot,
            accountRoot,
            tx,
            userPDAProof,
            NewAccountMP,
        );
        const [newBalanceRoot, createdAccountBytes, errorCode] = [result[0], result[1], result[3]];
        assert.equal(ErrorCode.NoError, errorCode.toNumber());

        const compressedTx = await RollupUtilsInstance.CompressCreateAccountNoStruct(
            tx.toIndex, tx.tokenType, tx.signature
        );
        await rollupCoreInstance.submitBatch(
            [compressedTx],
            newBalanceRoot,
            utils.Usage.CreateAccount,
            { value: ethers.utils.parseEther("32").toString() }
        );

        const createdAccount = await utils.AccountFromBytes(createdAccountBytes);
        accountStore.update(userAccountID, createdAccount);
        assert.equal(newBalanceRoot, await accountStore.getRoot());

    })

    it("Should Airdrop some token to the User", async function () {
        const tx = {
            fromIndex: Reddit.AccID,
            toIndex: User.AccID,
            tokenType: 1,
            nonce: 0,
            txType: utils.Usage.Airdrop,
            amount: 10,
        } as DropTx
        const signBytes = await RollupUtilsInstance.getDropSignBytes(
            tx.fromIndex, tx.toIndex, tx.tokenType, tx.txType, tx.nonce, tx.amount
        );
        tx.signature = utils.sign(signBytes, Reddit.Wallet);
        const txBytes = await RollupUtilsInstance.BytesFromTxAirdropDeconstructed(
            tx.fromIndex, tx.toIndex, tx.tokenType, tx.txType, tx.nonce, tx.amount
        );

        const redditMP = await accountStore.getAccountMerkleProof(Reddit.AccID);
        const resultFrom = await rollupRedditInstance.ApplyAirdropTx(redditMP, txBytes);
        const redditUpdatedAccount: Account = await utils.AccountFromBytes(resultFrom[0]);
        await accountStore.update(Reddit.AccID, redditUpdatedAccount);

        const userMP = await accountStore.getAccountMerkleProof(User.AccID);
        const resultTo = await rollupRedditInstance.ApplyAirdropTx(userMP, txBytes);
        const userUpdatedAccount = await utils.AccountFromBytes(resultTo[0]);
        await accountStore.update(User.AccID, userUpdatedAccount);

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
        )
        const [newBalanceRoot, errorCode] = [resultProcessTx[0], resultProcessTx[3]];
        assert.equal(errorCode, ErrorCode.NoError);
        assert.equal(newBalanceRoot, resultTo[1]);

        const compressedTx = await RollupUtilsInstance.CompressDropNoStruct(
            tx.toIndex, tx.amount, tx.signature
        );
        await rollupCoreInstance.submitBatch(
            [compressedTx],
            newBalanceRoot,
            utils.Usage.Airdrop,
            { value: ethers.utils.parseEther("32").toString() }
        );

        assert.equal(newBalanceRoot, await accountStore.getRoot());

    })

})
