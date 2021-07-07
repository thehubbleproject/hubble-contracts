import { assert } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { AccountRegistry } from "../ts/accountTree";
import { allContracts } from "../ts/allContractsInterfaces";
import { BLOCKS_PER_SLOT, PRODUCTION_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";
import {
    Group,
    txCreate2TransferFactory,
    txMassMigrationFactory,
    txTransferFactory
} from "../ts/factory";
import { DeploymentParameters } from "../ts/interfaces";
import { MigrationTree, StateTree } from "../ts/stateTree";
import * as mcl from "../ts/mcl";
import {
    BodylessCommitment,
    CommitmentInclusionProof,
    Create2TransferBatch,
    Create2TransferCommitment,
    getGenesisProof,
    MassMigrationBatch,
    MassMigrationCommitment,
    TransferBatch,
    TransferCommitment
} from "../ts/commitments";
import { getBatchID, hexToUint8Array, mineBlocks } from "../ts/utils";
import { serialize } from "../ts/tx";
import { CustomToken, CustomToken__factory } from "../types/ethers-contracts";
import { CommonToken } from "../ts/decimal";
import { deployKeyless } from "../ts/deployment/deploy";

// In the deploy script, we already have a TestToken registered with tokenID 0
// We are deploying a new token with tokenID 1
const tokenID = 1;

describe("Integration Test", function() {
    let contracts: allContracts;
    let stateTree: StateTree;
    let parameters: DeploymentParameters;
    let deployer: Signer;
    let coordinator: Signer;
    let stakedBatchIDs: number[] = [];
    let withdrawer: Signer;
    let accountRegistry: AccountRegistry;
    let newToken: CustomToken;
    let nextStateID = 0;
    let previousProof: CommitmentInclusionProof;
    let earlyAdopters: Group;
    let newUsers: Group;
    let genesisRoot: string;
    let domain: Uint8Array;
    let migrationTrees: MigrationTree[] = [];
    let lastBiddedSlot: number = -100;

    before(async function() {
        this.timeout(100000);
        await mcl.init();
        [deployer, coordinator, withdrawer] = await ethers.getSigners();
        await deployKeyless(deployer, false);
        parameters = PRODUCTION_PARAMS;
        parameters.BLOCKS_TO_FINALISE = 100;
        stateTree = StateTree.new(parameters.MAX_DEPTH);
        genesisRoot = stateTree.root;
        contracts = await deployAll(deployer, {
            ...parameters,
            GENESIS_STATE_ROOT: genesisRoot
        });
        const { rollup, blsAccountRegistry } = contracts;
        domain = hexToUint8Array(await rollup.domainSeparator());

        accountRegistry = await AccountRegistry.new(
            blsAccountRegistry.connect(coordinator)
        );
    });
    beforeEach(async function() {
        // Remember to bid when a new slot starts
        if (lastBiddedSlot > 0) {
            const { burnAuction } = contracts;
            const newSlot = Number(await burnAuction.currentSlot());
            if (newSlot + 2 > lastBiddedSlot) {
                console.log("New slot", newSlot, "bid now");
                await burnAuction.connect(coordinator).bid("1", { value: "1" });
                lastBiddedSlot = newSlot + 2;
                console.log("can propose at slot", lastBiddedSlot);
            }
        }
    });
    it("Register another token", async function() {
        const { tokenRegistry } = contracts;
        newToken = await new CustomToken__factory(coordinator).deploy(
            "FreshCoin",
            "FRSH"
        );
        await tokenRegistry.requestRegistration(newToken.address);
        const tx = await tokenRegistry.finaliseRegistration(newToken.address);
        const [event] = await tokenRegistry.queryFilter(
            tokenRegistry.filters.RegisteredToken(null, null),
            tx.blockHash
        );

        assert.equal(event.args?.tokenID.toNumber(), tokenID);
    });
    it("Coordinator bid the first auction", async function() {
        const { burnAuction } = contracts;
        const genesisBlock = Number(await burnAuction.genesisBlock());

        // mine to slot 0
        await mineBlocks(
            ethers.provider,
            genesisBlock - ethers.provider.blockNumber
        );
        assert.equal(Number(await burnAuction.currentSlot()), 0);
        // bid slot 2
        await burnAuction.connect(coordinator).bid("1", { value: "1" });
        lastBiddedSlot = 2;
        // can't propose at slot 0 and 1
        // mine to slot 1
        await mineBlocks(ethers.provider, BLOCKS_PER_SLOT);
        assert.equal(Number(await burnAuction.currentSlot()), 1);
        // bid slot 3
        await burnAuction.connect(coordinator).bid("1", { value: "1" });
        await mineBlocks(ethers.provider, BLOCKS_PER_SLOT);
        // Slot 2 is when the auction finalize and the coordinator can propose
        assert.equal(Number(await burnAuction.currentSlot()), 2);
        for (const slot of [2, 3]) {
            const bid = await burnAuction.auction(slot);
            assert.equal(bid.coordinator, await coordinator.getAddress());
        }
        // Set currentSlot to a positive number, and we remember to bid in beforeEach
        lastBiddedSlot = 3;
    });
    it("Deposit some users", async function() {
        const { depositManager, rollup } = contracts;
        const subtreeSize = 2 ** parameters.MAX_DEPOSIT_SUBTREE_DEPTH;
        const nSubtrees = 10;
        const nDeposits = nSubtrees * subtreeSize;
        nextStateID = nDeposits;
        earlyAdopters = Group.new({
            n: nDeposits,
            initialStateID: 0,
            initialPubkeyID: 0,
            domain
        }).connect(stateTree);
        const balance = CommonToken.fromHumanValue("1234.0");
        const fromBlockNumber = await deployer.provider?.getBlockNumber();
        for (const user of earlyAdopters.userIterator()) {
            const pubkeyID = await accountRegistry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
            await newToken
                .connect(coordinator)
                .approve(depositManager.address, balance.l1Value);
            await depositManager
                .connect(coordinator)
                .depositFor(user.pubkeyID, balance.l1Value, tokenID);
        }

        const subtreeReadyEvents = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(null, null),
            fromBlockNumber
        );
        assert.equal(subtreeReadyEvents.length, nSubtrees);
        previousProof = getGenesisProof(genesisRoot);
        const subgroups = Array.from(earlyAdopters.groupInterator(subtreeSize));
        for (let i = 0; i < nSubtrees; i++) {
            const mergeOffsetLower = i * subtreeSize;
            const subgroup = subgroups[i];
            const vacant = stateTree.getVacancyProof(
                mergeOffsetLower,
                parameters.MAX_DEPOSIT_SUBTREE_DEPTH
            );
            const depositBatchID = i + 1;
            await rollup
                .connect(coordinator)
                .submitDeposits(depositBatchID, previousProof, vacant, {
                    value: parameters.STAKE_AMOUNT
                });
            const batchID = await getBatchID(rollup);
            stakedBatchIDs.push(batchID);
            subgroup.createStates({
                initialBalance: balance.l2Value,
                tokenID,
                zeroNonce: true
            });
            const depositBatch = new BodylessCommitment(
                stateTree.root
            ).toBatch();
            const batch = await rollup.getBatch(batchID);
            assert.equal(batch.commitmentRoot, depositBatch.commitmentRoot);
            previousProof = depositBatch.proofCompressed(0);
        }
    }).timeout(40000);
    it("Users doing Transfers", async function() {
        console.log("Next state ID", nextStateID);
        const { rollup } = contracts;
        const numCommits = 32;
        const feeReceiverID = 0;
        const commits = [];

        for (let i = 0; i < numCommits; i++) {
            const { txs, signature } = txTransferFactory(
                earlyAdopters,
                parameters.MAX_TXS_PER_COMMIT
            );
            stateTree.processTransferCommit(txs, feeReceiverID);
            const commit = TransferCommitment.new(
                stateTree.root,
                accountRegistry.root(),
                signature,
                feeReceiverID,
                serialize(txs)
            );
            commits.push(commit);
        }
        const transferBatchID = await rollup.nextBatchID();
        await new TransferBatch(commits).submit(
            rollup.connect(coordinator),
            transferBatchID,
            parameters.STAKE_AMOUNT
        );
        const batchID = await getBatchID(rollup);
        stakedBatchIDs.push(batchID);
    });
    it("Getting new users via Create to transfer", async function() {
        const { rollup } = contracts;
        const numCommits = 32;
        const nNewUsers = parameters.MAX_TXS_PER_COMMIT * numCommits;
        // We'll update pubkeyIDs later
        newUsers = Group.new({
            n: nNewUsers,
            initialStateID: nextStateID,
            initialPubkeyID: 0,
            domain
        });
        const batchSize = accountRegistry.batchSize;
        // We happen to number of newUsers as a multiple of batchSize, so no need to handle single registration case
        for (const group of newUsers.groupInterator(batchSize)) {
            const firstID = await accountRegistry.registerBatch(
                group.getPubkeys()
            );
            for (let i = 0; i < batchSize; i++) {
                group.getUser(i).pubkeyID = firstID + i;
            }
        }
        const feeReceiverID = 0;

        const commits: TransferCommitment[] = [];
        const kindEarlyAdopters = earlyAdopters.slice(
            parameters.MAX_TXS_PER_COMMIT
        );
        const newUsersGroups = Array.from(
            newUsers.groupInterator(parameters.MAX_TXS_PER_COMMIT)
        );
        for (let i = 0; i < numCommits; i++) {
            const { txs, signature } = txCreate2TransferFactory(
                kindEarlyAdopters,
                newUsersGroups[i]
            );
            stateTree.processCreate2TransferCommit(txs, feeReceiverID);
            const commit = Create2TransferCommitment.new(
                stateTree.root,
                accountRegistry.root(),
                signature,
                feeReceiverID,
                serialize(txs)
            );
            commits.push(commit);
        }
        const c2TBatchID = await rollup.nextBatchID();
        await new Create2TransferBatch(commits).submit(
            rollup.connect(coordinator),
            c2TBatchID,
            parameters.STAKE_AMOUNT
        );
        const batchID = await getBatchID(rollup);
        stakedBatchIDs.push(batchID);
    }).timeout(240000);
    it("Exit via mass migration", async function() {
        const { rollup, withdrawManager } = contracts;
        // The spokeID of the withdrawManager preregistered in the deploy script
        const spokeID = 1;
        const numCommits = 32;
        const feeReceiverID = 0;
        const commits = [];
        const allUsers = earlyAdopters.join(newUsers);
        const allUserGroups = Array.from(
            allUsers.groupInterator(parameters.MAX_TXS_PER_COMMIT)
        );
        for (let i = 0; i < numCommits; i++) {
            const group = allUserGroups[i];
            const { txs, signature } = txMassMigrationFactory(group, spokeID);
            stateTree.processMassMigrationCommit(txs, feeReceiverID);

            const {
                commitment,
                migrationTree
            } = MassMigrationCommitment.fromStateProvider(
                accountRegistry.root(),
                txs,
                signature,
                feeReceiverID,
                stateTree
            );
            commits.push(commitment);
            migrationTrees.push(migrationTree);
        }
        const batch = new MassMigrationBatch(commits);
        const mMBatchID = await rollup.nextBatchID();
        await batch.submit(
            rollup.connect(coordinator),
            mMBatchID,
            parameters.STAKE_AMOUNT
        );
        const batchID = await getBatchID(rollup);
        stakedBatchIDs.push(batchID);

        await mineBlocks(ethers.provider, parameters.BLOCKS_TO_FINALISE);
        for (let i = 0; i < commits.length; i++) {
            await withdrawManager.processWithdrawCommitment(
                batchID,
                batch.proof(i)
            );
        }

        // We sample only one user from each commitment to withdraw
        // Let all users share same withdrawerAddress
        const withdrawerAddress = await withdrawer.getAddress();
        for (let i = 0; i < numCommits; i++) {
            const preBalance = await newToken.balanceOf(withdrawerAddress);
            const group = allUserGroups[i];
            const tree = migrationTrees[i];
            const { user, index } = group.pickRandom();
            const signature = user.signRaw(withdrawerAddress).sol;
            // The new stateID in the migration tree is the position user in the group
            const withdrawProof = tree.getWithdrawProof(index);
            await withdrawManager
                .connect(withdrawer)
                .claimTokens(
                    tree.root,
                    withdrawProof,
                    user.pubkey,
                    signature,
                    accountRegistry.witness(user.pubkeyID)
                );
            const postBalance = await newToken.balanceOf(withdrawerAddress);
            assert.equal(
                postBalance.sub(preBalance).toString(),
                CommonToken.fromL2Value(
                    withdrawProof.state.balance
                ).l1Value.toString()
            );
        }
    }).timeout(240000);
    it("Coordinator withdrew their stake", async function() {
        const { rollup } = contracts;
        for (const batchID of stakedBatchIDs) {
            const preBalance = await coordinator.getBalance();
            const tx = await rollup.connect(coordinator).withdrawStake(batchID);
            if (!tx.gasPrice) {
                throw new Error("txn missing gasPrice");
            }

            const txReceipt = await tx.wait();
            const txFee = txReceipt.gasUsed.mul(tx.gasPrice);
            const postBalance = await coordinator.getBalance();
            assert.equal(
                postBalance
                    .sub(preBalance)
                    .add(txFee)
                    .toString(),
                parameters.STAKE_AMOUNT.toString()
            );
        }
    });
});
