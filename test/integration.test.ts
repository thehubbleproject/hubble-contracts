import { assert } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { AccountRegistry } from "../ts/accountTree";
import { allContracts } from "../ts/allContractsInterfaces";
import {
    BLOCKS_PER_SLOT,
    DELTA_BLOCKS_INITIAL_SLOT,
    PRODUCTION_PARAMS
} from "../ts/constants";
import { deployAll } from "../ts/deploy";
import {
    txCreate2TransferFactory,
    txMassMigrationFactory,
    txTransferFactory,
    UserStateFactory
} from "../ts/factory";
import { DeploymentParameters } from "../ts/interfaces";
import { StateTree } from "../ts/stateTree";
import { TestTokenFactory } from "../types/ethers-contracts";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";
import * as mcl from "../ts/mcl";
import { TestToken } from "../types/ethers-contracts/TestToken";
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
import { getBatchID, mineBlocks, ZERO } from "../ts/utils";
import { State } from "../ts/state";
import { serialize } from "../ts/tx";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Integration Test", function() {
    let contracts: allContracts;
    let stateTree: StateTree;
    let parameters: DeploymentParameters;
    let deployer: Signer;
    let coordinator: Signer;
    let accountRegistry: AccountRegistry;
    let newToken: TestToken;
    let nextStateID = 0;
    let previousProof: CommitmentInclusionProof;
    let earlyAdopters: State[];
    let newUsers: State[];

    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
        [deployer, coordinator] = await ethers.getSigners();
        parameters = PRODUCTION_PARAMS;
        stateTree = StateTree.new(parameters.MAX_DEPTH);
        parameters.GENESIS_STATE_ROOT = stateTree.root;
        contracts = await deployAll(deployer, parameters);

        accountRegistry = await AccountRegistry.new(
            contracts.blsAccountRegistry.connect(coordinator)
        );
    });
    it("Register another token", async function() {
        const { tokenRegistry } = contracts;
        newToken = await new TestTokenFactory(coordinator).deploy();
        await tokenRegistry.requestRegistration(newToken.address);
        const tx = await tokenRegistry.finaliseRegistration(newToken.address);
        const [event] = await tokenRegistry.queryFilter(
            tokenRegistry.filters.RegisteredToken(null, null),
            tx.blockHash
        );
        // In the deploy script, we already have a TestToken registered with tokenID 1
        assert.equal(event.args?.tokenType, 2);
    });
    it("Coordinator bid the first auction", async function() {
        const burnAuction = contracts.chooser as BurnAuction;
        await burnAuction.connect(coordinator).bid({ value: "1" });
        await mineBlocks(
            ethers.provider,
            DELTA_BLOCKS_INITIAL_SLOT + BLOCKS_PER_SLOT
        );
        await burnAuction.connect(coordinator).bid({ value: "1" });
        await mineBlocks(ethers.provider, BLOCKS_PER_SLOT);
        // Slot 2 is when the auction finalize and the coordinator can propose
        assert.equal(Number(await burnAuction.currentSlot()), 2);
        for (const slot of [2, 3]) {
            const bid = await burnAuction.auction(slot);
            assert.equal(bid.coordinator, await coordinator.getAddress());
        }
    });
    it("Deposit some users", async function() {
        const { depositManager, rollup } = contracts;
        const subtreeSize = 1 << parameters.MAX_DEPOSIT_SUBTREE_DEPTH;
        const nSubtrees = 10;
        const nDeposits = nSubtrees * subtreeSize;
        nextStateID = nDeposits + 1;
        earlyAdopters = UserStateFactory.buildList({
            numOfStates: nDeposits,
            initialStateID: 0,
            initialAccID: 0,
            tokenID: 2,
            zeroNonce: true
        });

        const fromBlockNumber = await deployer.provider?.getBlockNumber();
        for (const state of earlyAdopters) {
            const pubkeyID = await accountRegistry.register(state.getPubkey());
            assert.equal(pubkeyID, state.pubkeyIndex);
            await newToken
                .connect(coordinator)
                .approve(depositManager.address, state.balance);
            await depositManager
                .connect(coordinator)
                .depositFor(state.pubkeyIndex, state.balance, state.tokenType);
        }

        const subtreeReadyEvents = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(null),
            fromBlockNumber
        );
        assert.equal(subtreeReadyEvents.length, nSubtrees);
        previousProof = getGenesisProof(
            parameters.GENESIS_STATE_ROOT as string
        );
        for (let i = 0; i < nSubtrees; i++) {
            const mergeOffsetLower = i * subtreeSize;
            const statesToUpdate = earlyAdopters.slice(
                mergeOffsetLower,
                mergeOffsetLower + subtreeSize
            );
            const vacant = stateTree.getVacancyProof(
                mergeOffsetLower,
                parameters.MAX_DEPOSIT_SUBTREE_DEPTH
            );
            await rollup
                .connect(coordinator)
                .submitDeposits(previousProof, vacant, {
                    value: parameters.STAKE_AMOUNT
                });
            const batchID = await getBatchID(rollup);
            stateTree.createStateBulk(statesToUpdate);
            const depositBatch = new BodylessCommitment(
                stateTree.root
            ).toBatch();
            const batch = await rollup.getBatch(batchID);
            assert.equal(batch.commitmentRoot, depositBatch.commitmentRoot);
            previousProof = depositBatch.proofCompressed(0);
        }
    });
    it("Users doing Transfers", async function() {
        console.log("Next state ID", nextStateID);
        const { rollup } = contracts;
        const numCommits = 32;
        const feeReceiverID = 0;
        const commits = [];

        for (let i = 0; i < numCommits; i++) {
            const txs = txTransferFactory(
                earlyAdopters,
                parameters.MAX_TXS_PER_COMMIT
            );
            const signature = mcl.aggreagate(
                txs.map(tx => earlyAdopters[tx.fromIndex].sign(tx))
            );
            const { safe } = stateTree.processTransferCommit(
                txs,
                feeReceiverID
            );
            assert.isTrue(safe);
            const commit = TransferCommitment.new(
                stateTree.root,
                accountRegistry.root(),
                signature,
                feeReceiverID,
                serialize(txs)
            );
            commits.push(commit);
        }
        await new TransferBatch(commits).submit(
            rollup.connect(coordinator),
            parameters.STAKE_AMOUNT
        );
    });
    it("Getting new users via Create to transfer", async function() {
        const { rollup } = contracts;
        const numCommits = 32;
        const nNewUsers = parameters.MAX_TXS_PER_COMMIT * numCommits;
        // We happen to have number of public key registered equal to number of states created.
        const nextPubkeyID = nextStateID;
        newUsers = UserStateFactory.buildList({
            numOfStates: nNewUsers,
            initialStateID: nextStateID,
            initialAccID: nextPubkeyID,
            tokenID: 2,
            initialBalance: ZERO,
            zeroNonce: true
        });
        const feeReceiverID = 0;
        const commits = [];
        for (let i = 0; i < numCommits; i++) {
            const sliceLeft = i * parameters.MAX_TXS_PER_COMMIT;
            const users = newUsers.slice(
                sliceLeft,
                sliceLeft + parameters.MAX_TXS_PER_COMMIT
            );
            const txs = txCreate2TransferFactory(
                earlyAdopters,
                users,
                parameters.MAX_TXS_PER_COMMIT
            );
            const signature = mcl.aggreagate(
                txs.map(tx => earlyAdopters[tx.fromIndex].sign(tx))
            );
            const { safe } = stateTree.processCreate2TransferCommit(
                txs,
                feeReceiverID
            );
            assert.isTrue(safe);
            const commit = Create2TransferCommitment.new(
                stateTree.root,
                accountRegistry.root(),
                signature,
                feeReceiverID,
                serialize(txs)
            );
            commits.push(commit);
        }
        await new Create2TransferBatch(commits).submit(
            rollup.connect(coordinator),
            parameters.STAKE_AMOUNT
        );
    });
    it("Exit via mass migration", async function() {
        const { rollup } = contracts;
        // The spokeID of the withdrawManager preregistered in the deploy script
        const spokeID = 0;
        const numCommits = 32;
        const feeReceiverID = 0;
        const commits = [];
        const allUsers = earlyAdopters.concat(newUsers)
        for (let i = 0; i < numCommits; i++) {
            const sliceLeft = i * parameters.MAX_TXS_PER_COMMIT;
            const users = allUsers.slice(
                sliceLeft,
                sliceLeft + parameters.MAX_TXS_PER_COMMIT
            );
            const txs = txMassMigrationFactory(
                users,
                parameters.MAX_TXS_PER_COMMIT,
                spokeID
            );
            const signature = mcl.aggreagate(
                txs.map(tx => allUsers[tx.fromIndex].sign(tx))
            );
            const { safe } = stateTree.processMassMigrationCommit(
                txs,
                feeReceiverID
            );
            assert.isTrue(safe, `Invalid state transition at ${i}`);
            const commit = MassMigrationCommitment.new(
                stateTree.root,
                accountRegistry.root(),
                signature,
                feeReceiverID,
                serialize(txs)
            );
            commits.push(commit);
        }
        await new MassMigrationBatch(commits).submit(
            rollup.connect(coordinator),
            parameters.STAKE_AMOUNT
        );
    });
    it("Users withdraw funds");
    it("Coordinator withdrew their stack");
});
