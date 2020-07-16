import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import { Transaction, ErrorCode, CreateAccount, Account } from "../scripts/helpers/interfaces";
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
    let testTokenInstance;
    let depositManagerInstance;
    let rollupCoreInstance: any;
    let IMTInstance: any;
    before(async function () {
        depositManagerInstance = await DepositManager.deployed();
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
        Reddit = {
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 50,
            TokenType: 1,
            AccID: 2,
            Path: "2",
            nonce: 0,
        };
        User = {
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 3,
            Path: "3",
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
        rollupCoreInstance = await RollupCore.deployed();
        IMTInstance = await IMT.deployed();
    })
    it("Should Create Account for the User", async function () {
        const createAccountInstance = await createAccount.deployed();
        // Call to see what's the accountID
        const accountId = await createAccountInstance.createPublickeys.call([User.Pubkey]);
        assert.equal(accountId.toString(), "3");
        // Actual execution
        await createAccountInstance.createPublickeys([User.Pubkey]);

        const tx = {
            toIndex: 3,
            tokenType: 1
        } as CreateAccount;
        const RollupUtilsInstance = await RollupUtils.deployed();
        const signBytes = await RollupUtilsInstance.getCreateAccountSignBytes(tx.toIndex, tx.tokenType);
        tx.signature = utils.sign(signBytes, wallets[0]);
        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();
        const ZeroAccount: Account = {
            ID: 0,
            tokenType: 0,
            balance: 0,
            nonce: 0,
            burn: 0,
            lastBurn: 0
        }
        const RedditAccountLeaf = await utils.createLeaf(Reddit)
        const zeroHashes = await utils.defaultHashes(4);
        const coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
        const NewAccountSiblings: Array<string> = [
            RedditAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3],
        ];
        const NewAccountMP = {
            accountIP: {
                pathToAccount: User.Path,
                account: ZeroAccount,
            },
            siblings: NewAccountSiblings,
        };
        const coordinatorPubkeyHash =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";

        const userPDAsiblings = [
            utils.PubKeyHash(Reddit.Pubkey),
            utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
            zeroHashes[2],
            zeroHashes[3],
        ];
        const userPDAProof = {
            _pda: {
                pathToPubkey: "3",
                pubkey_leaf: { pubkey: User.Pubkey },
            },
            siblings: userPDAsiblings,
        }
        await createAccountInstance.processTx(
            balanceRoot,
            accountRoot,
            tx,
            userPDAProof,
            NewAccountMP,
        )
    })

})