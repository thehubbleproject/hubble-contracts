import { arrayify } from "@ethersproject/bytes";
import { assert } from "chai";
import { providers } from "ethers";
import { ethers } from "hardhat";
import { CoreAPI } from "../../ts/client/coreAPI";
import { ConcreteBatch } from "../../ts/client/features/base";
import { DepositCommitment } from "../../ts/client/features/deposit";
import { GenesisCommitment } from "../../ts/client/features/genesis";
import {
    SimulatorPool,
    TransferPackingCommand
} from "../../ts/client/features/transfer";
import { SyncerService } from "../../ts/client/services/syncer";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { CommonToken } from "../../ts/decimal";
import { deployAll } from "../../ts/deploy";
import { deployKeyless } from "../../ts/deployment/deploy";
import { Group, storageManagerFactory } from "../../ts/factory";
import { Genesis } from "../../ts/genesis";
import * as mcl from "../../ts/mcl";
import { Pubkey } from "../../ts/pubkey";
import { State } from "../../ts/state";
import { StateTree } from "../../ts/stateTree";

/**
 * This integration test ensures a node in syncing mode
 * successfully updates its state from L1 events.
 *
 * Eventually, this test can also verify that a proposing/packer
 * node correctly submits state changes (rollups) and that a
 * syncing node updates from those changes.
 *
 * When a watching/contesting node is implemented,
 * this might be worth moving over to more of a
 * E2E (end-to-end) style test in which all 3 node
 * types run independantly on an initial data set
 * and reach a correct end state.
 */
describe("Client Integration", function() {
    it("run", async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        const provider = signer.provider as providers.Provider;
        const genesisEth1Block = await provider.getBlockNumber();
        await deployKeyless(signer, false);

        const storagePacker = await storageManagerFactory();
        const storageSyncer = await storageManagerFactory();

        // Ensure initial states match
        assert.equal(storageSyncer.state.root, storagePacker.state.root);
        assert.equal(storageSyncer.pubkey.root, storagePacker.pubkey.root);

        // Deploy contracts
        const parameters = PRODUCTION_PARAMS;
        parameters.USE_BURN_AUCTION = false;
        parameters.GENESIS_STATE_ROOT = storagePacker.state.root;

        const contracts = await deployAll(signer, parameters);

        // Setup L2 state for packer and L1 state for syncer.
        // As feature development progresses, much of this
        // can be replaced with packer/proposer logic.
        const numUsers = 32;
        const tokenID = 0; // ExampleToken
        const initialBalance = CommonToken.fromHumanValue("100.12");
        const group = Group.new({ n: numUsers });

        // This state tree will be linked with group and used
        // to help generate deposit proofs. In the future,
        // this is what the packer/proposer will do.
        const stateTree = StateTree.new(parameters.MAX_DEPTH);
        group.connect(stateTree);

        // Create genesis proof as our L1 state starting point
        const genCommit = new GenesisCommitment(parameters.GENESIS_STATE_ROOT);
        const genesisBatch = new ConcreteBatch([genCommit]);
        const genesisProof = genesisBatch.proofCompressed(0);

        // Split users in subtree sized chunks
        let numDepositBatches = 0;
        const subtreeSize = 2 ** parameters.MAX_DEPOSIT_SUBTREE_DEPTH;
        await Array.from(group.groupInterator(subtreeSize)).reduce(
            async (prevProofPromise, curSubGroup, i) => {
                const prevProof = await prevProofPromise;

                // Setup L2 storage & L1 subtree
                for (const user of curSubGroup.userIterator()) {
                    // Setup packer L2 pubkeys
                    await storagePacker.pubkey.update(
                        user.pubkeyID,
                        new Pubkey(user.pubkey)
                    );
                    // And state
                    const state = State.new(
                        user.pubkeyID,
                        tokenID,
                        initialBalance.l2Value,
                        0
                    );
                    await storagePacker.state.update(user.stateID, state);

                    // Setup L1 for syncer & packing
                    // Pubkey
                    await contracts.blsAccountRegistry.register(user.pubkey);
                    // Approve token transfer
                    await contracts.exampleToken.approve(
                        contracts.depositManager.address,
                        initialBalance.l1Value
                    );
                    // Queue deposit
                    await contracts.depositManager.depositFor(
                        user.pubkeyID,
                        initialBalance.l1Value,
                        tokenID
                    );
                }

                // Submit enqueued L1 deposits from above (packer submitDeposit simulation)
                const mergeOffsetLower = i * subtreeSize;
                const vacant = stateTree.getVacancyProof(
                    mergeOffsetLower,
                    parameters.MAX_DEPOSIT_SUBTREE_DEPTH
                );
                await contracts.rollup.submitDeposits(prevProof, vacant, {
                    value: parameters.STAKE_AMOUNT
                });
                numDepositBatches++;

                // Update local state tree
                curSubGroup.createStates({
                    initialBalance: initialBalance.l2Value,
                    tokenID,
                    zeroNonce: true
                });
                // This is required by DepositCommitment but is not used in generating proof
                const context = {
                    subtreeID: -1,
                    depositSubtreeRoot: "fake",
                    pathToSubTree: -1
                };

                // Generate next deposit proof
                const commitment = new DepositCommitment(
                    stateTree.root,
                    context
                );
                const depositBatch = new ConcreteBatch([commitment]);
                const depositProof = depositBatch.proofCompressed(0);

                return depositProof;
            },
            Promise.resolve(genesisProof)
        );

        // Save L2 pubkeys & state
        await storagePacker.pubkey.commit();
        await storagePacker.state.commit();
        // End initial L2 & L1 data setup

        const domainSeparator = await contracts.rollup.domainSeparator();
        group.setupSigners(arrayify(domainSeparator));

        // Setup a pool which simulates random token transfers
        const simPool = new SimulatorPool(group, storagePacker);
        await simPool.setTokenID();

        const genesis = await Genesis.fromContracts(
            contracts,
            parameters,
            genesisEth1Block
        );
        const apiPacker = CoreAPI.new(
            storagePacker,
            genesis,
            provider,
            signer,
            simPool
        );
        const apiSyncer = CoreAPI.new(
            storageSyncer,
            genesis,
            provider,
            signer,
            simPool
        );

        const packingCommand = new TransferPackingCommand(
            apiPacker.parameters,
            apiPacker.l2Storage,
            simPool,
            apiPacker.rollup,
            apiPacker.verifier
        );
        const numTransferBatches = 10;
        for (let i = 0; i < numTransferBatches; i++) {
            await packingCommand.packAndSubmit();
        }

        // Simulate syncing node
        const syncService = new SyncerService(apiSyncer);
        await syncService.initialSync();

        // Confirm final states match
        assert.equal(storageSyncer.state.root, storagePacker.state.root);
        assert.equal(storageSyncer.pubkey.root, storagePacker.pubkey.root);

        // Confirm storage has correct counts
        const numGenesisBatches = 1;
        const numBatches =
            numGenesisBatches + numDepositBatches + numTransferBatches;
        assert.equal(storageSyncer.batches.count(), numBatches);
        // Because of randomization, this will fall in a range between 10240 and 10560 (delta 320);
        const minNumTxns =
            numTransferBatches * parameters.MAX_TXS_PER_COMMIT ** 2;
        const maxNumTxns =
            minNumTxns + numTransferBatches * parameters.MAX_TXS_PER_COMMIT;
        assert.isAtLeast(storageSyncer.transactions.count(), minNumTxns);
        assert.isAtMost(storageSyncer.transactions.count(), maxNumTxns);

        // Note: This will not include deposit batches until the packing command becomes a packing node.
        assert.equal(storagePacker.batches.count(), numTransferBatches);
        assert.isAtLeast(storagePacker.transactions.count(), minNumTxns);
        assert.isAtMost(storagePacker.transactions.count(), maxNumTxns);
    }).timeout(300000);
});
