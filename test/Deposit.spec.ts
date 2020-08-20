
import * as walletHelper from "../scripts/helpers/wallet";
import { Wallet } from "../scripts/helpers/interfaces";
import * as utils from "../scripts/helpers/utils";

import { ethers } from "@nomiclabs/buidler";
import { StateStore } from "../scripts/helpers/store";
import { TESTING_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";

describe("DepositManager", async function() {
    let wallets: Wallet[];
    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);

    });

    xit("should allow depositing 2 leaves in a subtree and merging it", async () => {
        const signer = (await ethers.getSigners())[0];
        const contracts = await deployAll(signer, TESTING_PARAMS)
        const testTokenInstance = contracts.testToken
        const depositManagerInstance = contracts.depositManager
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
        const coordinator_leaves = await contracts.rollupUtils.GetGenesisLeaves();
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

        // TODO: Test dequeue

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

        await contracts.rollup.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            subTreeIsEmptyProof,
            { value: TESTING_PARAMS.STAKE_AMOUNT }
        );

        //
        // verify accounts exist in the new balance root
        //
        const newBalanceRoot = await contracts.rollup.getLatestBalanceTreeRoot();

        // verify sub tree has been inserted first at path 0
        const isSubTreeInserted = await contracts.merkleTreeUtils.verifyLeaf(
            newBalanceRoot,
            utils.getParentLeaf(AliceAccountLeaf, BobAccountLeaf),
            position,
            subTreeIsEmptyProof.siblings
        );
        expect(isSubTreeInserted).to.be.deep.eq(true);
    });
});
