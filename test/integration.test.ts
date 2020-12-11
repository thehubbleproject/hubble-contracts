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
    Group,
    txCreate2TransferFactory,
    txMassMigrationFactory,
    txTransferFactory
} from "../ts/factory";
import { DeploymentParameters } from "../ts/interfaces";
import { StateTree } from "../ts/stateTree";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";
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
import { getBatchID, hexToUint8Array, mineBlocks, sum } from "../ts/utils";
import { serialize } from "../ts/tx";
import { Tree } from "../ts/tree";
import { ExampleToken } from "../types/ethers-contracts/ExampleToken";
import { ExampleTokenFactory } from "../types/ethers-contracts";
import { USDT } from "../ts/decimal";
import { State } from "../ts/state";

// In the deploy script, we already have a TestToken registered with tokenID 0
// We are deploying a new token with tokenID 1
const tokenID = 1;

describe("Integration Test", function() {
    let contracts: allContracts;
    let stateTree: StateTree;
    let parameters: DeploymentParameters;
    let deployer: Signer;
    let coordinator: Signer;
    let accountRegistry: AccountRegistry;
    let newToken: ExampleToken;
    let nextStateID = 0;
    let previousProof: CommitmentInclusionProof;
    let earlyAdopters: Group;
    let newUsers: Group;
    let massMigrationBatch: MassMigrationBatch;
    let genesisRoot: string;
    let domain: Uint8Array;

    before(async function() {
        await mcl.init();
        [deployer, coordinator] = await ethers.getSigners();
        parameters = PRODUCTION_PARAMS;
        parameters.BLOCKS_TO_FINALISE = 100;
        stateTree = StateTree.new(parameters.MAX_DEPTH);
        genesisRoot = stateTree.root;
        contracts = await deployAll(deployer, {
            ...parameters,
            GENESIS_STATE_ROOT: genesisRoot
        });
        const { rollup, blsAccountRegistry } = contracts;
        domain = hexToUint8Array(await rollup.appID());

        accountRegistry = await AccountRegistry.new(
            blsAccountRegistry.connect(coordinator)
        );
    });
    it("Register another token", async function() {
        const { tokenRegistry } = contracts;
        newToken = await new ExampleTokenFactory(coordinator).deploy();
        await tokenRegistry.requestRegistration(newToken.address);
        const tx = await tokenRegistry.finaliseRegistration(newToken.address);
        const [event] = await tokenRegistry.queryFilter(
            tokenRegistry.filters.RegisteredToken(null, null),
            tx.blockHash
        );

        assert.equal(event.args?.tokenID, tokenID);
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
        nextStateID = nDeposits;
        earlyAdopters = Group.new({
            n: nDeposits,
            initialStateID: 0,
            initialPubkeyID: 0,
            domain
        }).connect(stateTree);
        const balance = USDT.castInt(1234.0);
        const fromBlockNumber = await deployer.provider?.getBlockNumber();
        for (const user of earlyAdopters.userIterator()) {
            const pubkeyID = await accountRegistry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
            await newToken
                .connect(coordinator)
                .approve(depositManager.address, balance);
            await depositManager
                .connect(coordinator)
                .depositFor(user.pubkeyID, balance, tokenID);
        }

        const subtreeReadyEvents = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(null),
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
            await rollup
                .connect(coordinator)
                .submitDeposits(previousProof, vacant, {
                    value: parameters.STAKE_AMOUNT
                });
            const batchID = await getBatchID(rollup);
            subgroup.createStates({
                initialBalance: balance,
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
    });
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
        newUsers = Group.new({
            n: nNewUsers,
            initialStateID: nextStateID,
            initialPubkeyID: nextPubkeyID,
            domain
        });
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
        const allUsers = earlyAdopters.join(newUsers);
        const allUserGroups = Array.from(
            allUsers.groupInterator(parameters.MAX_TXS_PER_COMMIT)
        );
        for (let i = 0; i < numCommits; i++) {
            const group = allUserGroups[i];
            const { txs, signature, senders } = txMassMigrationFactory(
                group,
                spokeID
            );
            stateTree.processMassMigrationCommit(txs, feeReceiverID);
            const withdrawRoot = Tree.merklize(
                txs.map((tx, j) =>
                    State.new(
                        senders[j].pubkeyID,
                        tokenID,
                        tx.amount,
                        0
                    ).toStateLeaf()
                )
            ).root;
            const commit = MassMigrationCommitment.new(
                stateTree.root,
                accountRegistry.root(),
                signature,
                spokeID,
                withdrawRoot,
                tokenID,
                sum(txs.map(tx => tx.amount)),
                feeReceiverID,
                serialize(txs)
            );
            commits.push(commit);
        }
        massMigrationBatch = new MassMigrationBatch(commits);
        await massMigrationBatch.submit(
            rollup.connect(coordinator),
            parameters.STAKE_AMOUNT
        );
    });
    it("Users withdraw funds", async function() {
        await mineBlocks(ethers.provider, parameters.BLOCKS_TO_FINALISE);
    });
    it("Coordinator withdrew their stack");
});
