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

/*
    Some functions require this struct be passed but not verify it.
 */
const DummyAccount: Account = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0,
    burn: 0,
    lastBurn: 0
}

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
    let defaultHashes: string[];
    let coordinator_leaves: string;
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
            Path: "2",
            nonce: 0,
        };
        Bob = {
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 1,
            TokenType: 1,
            AccID: 3,
            Path: "3",
            nonce: 0,
        };
        User = {
            Address: wallets[2].getAddressString(),
            Pubkey: wallets[2].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 4,
            Path: "4",
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
        defaultHashes = await utils.defaultHashes(4);
        coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
        const siblingsInProof = [
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            defaultHashes[2],
            defaultHashes[3],
        ];
        const _zero_account_mp = {
            accountIP: {
                pathToAccount: "001",
                account: DummyAccount,
            },
            siblings: siblingsInProof,
        };
        const subtreeDepth = 1

        await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            _zero_account_mp,
            { value: ethers.utils.parseEther("32").toString() }
        );

    })
    it("Should Create Account for the User", async function () {
        const createAccountInstance = await createAccount.deployed();
        // Call to see what's the accountID
        const accountId = await createAccountInstance.createPublickeys.call([User.Pubkey]);
        assert.equal(accountId.toString(), User.AccID);
        // Actual execution
        await createAccountInstance.createPublickeys([User.Pubkey]);

        const tx = {
            toIndex: 4,
            tokenType: 1
        } as CreateAccount;
        const signBytes = await RollupUtilsInstance.getCreateAccountSignBytes(tx.toIndex, tx.tokenType);
        tx.signature = utils.sign(signBytes, wallets[0]);
        const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const RedditAccountLeaf = await utils.createLeaf(Reddit)
        const BobAccountLeaf = await utils.createLeaf(Bob);
        const n1 = utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1])
        const n2 = utils.getParentLeaf(RedditAccountLeaf, BobAccountLeaf)
        const n3 = utils.getParentLeaf(n1, n2);

        const NewAccountSiblings: Array<string> = [
            defaultHashes[0],
            defaultHashes[1],
            n3,
            defaultHashes[3],
        ];
        const NewAccountMP = {
            accountIP: {
                pathToAccount: User.Path,
                account: DummyAccount,
            },
            siblings: NewAccountSiblings,
        };
        const coordinatorPubkeyHash =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
        const p1 = utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash);
        const p2 = utils.getParentLeaf(utils.PubKeyHash(Reddit.Pubkey), utils.PubKeyHash(Bob.Pubkey))
        const p3 = utils.getParentLeaf(p1, p2);

        const userPDAsiblings = [
            defaultHashes[0],
            defaultHashes[1],
            p3,
            defaultHashes[3],
        ];
        const userPDAProof = {
            _pda: {
                pathToPubkey: User.AccID,
                pubkey_leaf: { pubkey: User.Pubkey },
            },
            siblings: userPDAsiblings,
        }
        const result = await createAccountInstance.processTx(
            balanceRoot,
            accountRoot,
            tx,
            userPDAProof,
            NewAccountMP,
        );
        assert.equal(ErrorCode.NoError, result[3].toNumber());

        const compressedTx = await RollupUtilsInstance.CompressCreateAccountDeconstructed(
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
