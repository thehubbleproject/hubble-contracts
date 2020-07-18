import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import { ErrorCode, CreateAccount, DropTx } from "../scripts/helpers/interfaces";
import { PublicKeyStore, AccountStore } from '../scripts/helpers/store';
import { coordinatorPubkeyHash, MAX_DEPTH } from '../scripts/helpers/constants';
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const EcVerify = artifacts.require("ECVerify");
const createAccount = artifacts.require("CreateAccount");


contract("Reddit", async function () {
    let wallets: any;
    let Reddit: any;
    let User: any;
    let Bob: any;
    let testTokenInstance;
    let depositManagerInstance;
    let rollupCoreInstance: any;
    let RollupUtilsInstance: any;
    let IMTInstance: any;
    let coordinator_leaves: string;
    let pubkeyStore: PublicKeyStore;
    let accountStore: AccountStore;
    before(async function () {
        depositManagerInstance = await DepositManager.deployed();
        rollupCoreInstance = await RollupCore.deployed();
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

        // Insert Reddit's and Bob's account after finaliseDepositsAndSubmitBatch
        accountStore.insertHash(await utils.createLeaf(Reddit));
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
        const NewAccountMP = await accountStore.getAccountMerkleProof(userAccountID);
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

        const createdAccount = await RollupUtilsInstance.AccountFromBytes(createdAccountBytes);
        accountStore.update(userAccountID, createdAccount);
        assert.equal(newBalanceRoot, await accountStore.getRoot());

    })

})
