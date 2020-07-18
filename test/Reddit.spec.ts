import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import { ErrorCode, CreateAccount } from "../scripts/helpers/interfaces";
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
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 50,
            TokenType: 1,
            AccID: 2,
            Path: 2,
            nonce: 0,
        };
        Bob = {
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 1,
            TokenType: 1,
            AccID: 3,
            Path: 3,
            nonce: 0,
        };
        User = {
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
        // Call to see what's the accountID
        const accountId = await createAccountInstance.createPublickeys.call([User.Pubkey]);
        assert.equal(accountId.toString(), User.AccID);
        // Actual execution
        await createAccountInstance.createPublickeys([User.Pubkey]);
        const userPubkeyIndex = await pubkeyStore.insertPublicKey(User.Pubkey);

        const tx = {
            toIndex: 4,
            tokenType: 1
        } as CreateAccount;
        const signBytes = await RollupUtilsInstance.getCreateAccountSignBytes(tx.toIndex, tx.tokenType);
        tx.signature = utils.sign(signBytes, wallets[0]);

        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const userAccountID = accountStore.nextEmptyIndex();
        const NewAccountMP = await accountStore.getAccountMerkleProof(userAccountID);
        const userPDAProof = await pubkeyStore.getPDAMerkleProof(userPubkeyIndex);

        const result = await createAccountInstance.processTx(
            balanceRoot,
            accountRoot,
            tx,
            userPDAProof,
            NewAccountMP,
        );
        assert.equal(ErrorCode.NoError, result[3].toNumber());

        const compressedTx = await RollupUtilsInstance.CompressCreateAccountNoStruct(
            tx.toIndex, tx.tokenType, tx.signature
        );
        await rollupCoreInstance.submitBatch(
            [compressedTx],
            result[0],
            utils.Usage.CreateAccount,
            { value: ethers.utils.parseEther("32").toString() }
        );


    })

})
