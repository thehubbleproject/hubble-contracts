import * as chai from "chai";
import * as walletHelper from "../scripts/helpers/wallet";
import { Wallet } from "../scripts/helpers/interfaces";
const TestToken = artifacts.require("TestToken");
const chaiAsPromised = require("chai-as-promised");
const DepositManager = artifacts.require("DepositManager");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
import * as utils from "../scripts/helpers/utils";

import { ethers } from "ethers";
const RollupCore = artifacts.require("Rollup");
const RollupUtils = artifacts.require("RollupUtils");
import { StateStore } from "../scripts/helpers/store";
import { TESTING_PARAMS } from "../ts/constants";
chai.use(chaiAsPromised);

contract("DepositManager", async function() {
    let wallets: Wallet[];
    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
    });

    it("should register a token", async function() {
        const testToken = await TestToken.deployed();
        const tokenRegistryInstance = await utils.getTokenRegistry();
        await tokenRegistryInstance.requestTokenRegistration(
            testToken.address,
            {
                from: wallets[0].getAddressString()
            }
        );
    });
    it("should finalise token registration", async () => {
        const testToken = await TestToken.deployed();
        const tokenRegistryInstance = await utils.getTokenRegistry();

        const approveToken = await tokenRegistryInstance.finaliseTokenRegistration(
            testToken.address,
            { from: wallets[0].getAddressString() }
        );
        assert(approveToken, "token registration failed");
    });
    it("should approve Rollup on TestToken", async () => {
        const testToken = await TestToken.deployed();
        const depositManagerInstance = await DepositManager.deployed();
        const approveToken = await testToken.approve(
            depositManagerInstance.address,
            ethers.utils.parseEther("1").toString(),
            {
                from: wallets[0].getAddressString()
            }
        );
        assert(approveToken, "approveToken failed");
    });

    xit("should allow depositing 2 leaves in a subtree and merging it", async () => {
        let depositManagerInstance = await DepositManager.deployed();
        var rollupContractInstance = await RollupCore.deployed();
        var testTokenInstance = await TestToken.deployed();
        let rollupCoreInstance = await RollupCore.deployed();
        var rollupUtilsInstance = await RollupUtils.deployed();
        const MTutilsInstance = await MerkleTreeUtils.deployed();
        const stateStore = new StateStore(TESTING_PARAMS.MAX_DEPTH);

        const Alice = {
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 2,
            Path: "2",
            nonce: 0
        };
        const Bob = {
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 3,
            Path: "3",
            nonce: 0
        };
        const coordinator_leaves = await rollupUtilsInstance.GetGenesisLeaves();
        for (const leaf of coordinator_leaves) {
            stateStore.insertHash(leaf);
        }

        const BalanceOfAlice = await testTokenInstance.balanceOf(Alice.Address);

        // Deposit Alice
        await depositManagerInstance.depositFor(
            Alice.Address,
            Alice.Amount,
            Alice.TokenType
        );
        const AliceAccountLeaf = await utils.createLeaf(Alice);

        const BalanceOfAliceAfterDeposit = await testTokenInstance.balanceOf(
            Alice.Address
        );

        assert.equal(
            Number(BalanceOfAliceAfterDeposit),
            Number(BalanceOfAlice) - Alice.Amount,
            "User balance did not reduce after deposit"
        );

        //
        // do second deposit
        //

        // do a deposit for bob
        await depositManagerInstance.depositFor(
            Bob.Address,
            Bob.Amount,
            Bob.TokenType
        );

        const BobAccountLeaf = await utils.createLeaf(Bob);

        const pendingDeposits0 = await depositManagerInstance.dequeue.call();

        assert.equal(
            pendingDeposits0,
            utils.getParentLeaf(AliceAccountLeaf, BobAccountLeaf),
            "Account hash mismatch 2"
        );

        const pendingDepositAfter = await depositManagerInstance.queueNumber();
        assert.equal(
            Number(pendingDepositAfter),
            0,
            "pending deposits mismatch"
        );

        // do a deposit for bob
        await depositManagerInstance.depositFor(
            Bob.Address,
            Bob.Amount,
            Bob.TokenType
        );

        // do a deposit for bob
        await depositManagerInstance.depositFor(
            Bob.Address,
            Bob.Amount,
            Bob.TokenType
        );

        const subtreeDepth = 1;
        const position = stateStore.findEmptySubTreePosition(subtreeDepth);
        const subTreeIsEmptyProof = await stateStore.getSubTreeMerkleProof(
            position,
            subtreeDepth
        );

        await rollupContractInstance.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            subTreeIsEmptyProof,
            { value: TESTING_PARAMS.STAKE_AMOUNT }
        );

        //
        // verify accounts exist in the new balance root
        //
        const newBalanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();

        // verify sub tree has been inserted first at path 0
        const isSubTreeInserted = await MTutilsInstance.verifyLeaf(
            newBalanceRoot,
            utils.getParentLeaf(AliceAccountLeaf, BobAccountLeaf),
            position,
            subTreeIsEmptyProof.siblings
        );
        expect(isSubTreeInserted).to.be.deep.eq(true);
    });
});
