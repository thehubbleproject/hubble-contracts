import { ethers } from "hardhat";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { constants } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { allContracts } from "../../ts/allContractsInterfaces";
import { TESTING_PARAMS } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { State } from "../../ts/state";
import { randomLeaves } from "../../ts/utils";
import {
    TestDepositCore,
    TestDepositCore__factory
} from "../../types/ethers-contracts";
import { TransferCommitment } from "../../ts/commitments";
import { StateTree } from "../../ts/stateTree";
import { ERC20ValueFactory } from "../../ts/decimal";
import { MemoryTree } from "../../ts/tree/memoryTree";

chai.use(chaiAsPromised);

describe("Deposit Core", async function() {
    let contract: TestDepositCore;
    const maxSubtreeDepth = 4;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contract = await new TestDepositCore__factory(signer).deploy(
            maxSubtreeDepth
        );
    });
    it("insert and merge many deposits", async function() {
        for (let j = 0; j < 5; j++) {
            const maxSubtreeSize = 2 ** maxSubtreeDepth;
            const leaves = randomLeaves(maxSubtreeSize);
            const tree = MemoryTree.new(maxSubtreeDepth);
            for (let i = 0; i < maxSubtreeSize; i++) {
                const gasCost = await contract.callStatic.testInsertAndMerge(
                    leaves[i]
                );
                console.log(
                    `Insert leaf ${i} \t Operation cost: ${gasCost.toNumber()}`
                );
                const tx = await contract.testInsertAndMerge(leaves[i]);
                const events = await contract.queryFilter(
                    contract.filters.DepositSubTreeReady(),
                    tx.blockHash
                );
                tree.updateSingle(i, leaves[i]);
                if (i !== maxSubtreeSize - 1) {
                    assert.equal(
                        events.length,
                        0,
                        "No ready subtree should be emitted"
                    );
                } else {
                    assert.equal(events[0].args?.subtreeID.toNumber(), j + 1);
                    assert.equal(
                        events[0].args?.subtreeRoot,
                        tree.root,
                        "Should be the merkle root of all leaves"
                    );
                }
            }
            assert.equal((await contract.back()).toNumber(), j + 1);
            assert.equal(
                await contract.getQueue(j + 1),
                tree.root,
                "subtree root should be in the subtree queue now"
            );
        }
    });
});

describe("DepositManager", async function() {
    let contracts: allContracts;
    let tokenID: number;
    let erc20: ERC20ValueFactory;
    beforeEach(async function() {
        const [signer] = await ethers.getSigners();
        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: constants.HashZero
        });
        const { exampleToken, tokenRegistry, depositManager } = contracts;
        tokenID = (await tokenRegistry.nextTokenID()).toNumber() - 1;
        erc20 = new ERC20ValueFactory(await exampleToken.decimals());
        const LARGE_AMOUNT_OF_TOKEN = erc20.fromHumanValue("1000000").l1Value;
        await exampleToken.approve(
            depositManager.address,
            LARGE_AMOUNT_OF_TOKEN
        );
    });
    it("fails if batchID is incorrect", async function() {
        const stateTree = StateTree.new(TESTING_PARAMS.MAX_DEPTH);
        const vacancyProof = stateTree.getVacancyProof(
            0,
            TESTING_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        const commit = TransferCommitment.new(
            stateTree.root,
            await contracts.blsAccountRegistry.root()
        );
        const batch = commit.toBatch();

        const invalidBatchID = 1337;
        await assert.isRejected(
            contracts.rollup.submitDeposits(
                invalidBatchID,
                batch.proofCompressed(0),
                vacancyProof,
                { value: TESTING_PARAMS.STAKE_AMOUNT }
            ),
            /.*batchID does not match nextBatchID.*/
        );
    });
    it("should bypass transfer if amount = 0", async function() {
        const { depositManager, exampleToken } = contracts;
        const amount = erc20.fromHumanValue("0");

        const txDeposit = await depositManager.depositFor(
            0,
            amount.l1Value,
            tokenID
        );
        const [event] = await exampleToken.queryFilter(
            exampleToken.filters.Transfer(null, null, null),
            txDeposit.blockHash
        );
        assert.isUndefined(event);
    });
    it("should fail if l1Amount is not a multiple of l2Unit", async function() {
        const { depositManager } = contracts;
        const amount = erc20.fromHumanValue("10");

        await assert.isRejected(
            depositManager.depositFor(0, amount.l1Value.sub(1), tokenID),
            "l1Amount should be a multiple of l2Unit"
        );
    });
    it("should fail if token allowance less than deposit amount", async function() {
        const { depositManager } = contracts;
        const amount = erc20.fromHumanValue("1000001");

        await assert.isRejected(
            depositManager.depositFor(0, amount.l1Value, tokenID),
            "token allowance not approved"
        );
    });
    it("should allow depositing 3 leaves in a subtree and merging the first 2", async function() {
        const { depositManager } = contracts;
        const amount = erc20.fromHumanValue("10");
        const deposit0 = State.new(0, tokenID, amount.l2Value, 0);
        const deposit1 = State.new(1, tokenID, amount.l2Value, 0);
        const deposit2 = State.new(2, tokenID, amount.l2Value, 0);
        const pendingDeposit = solidityKeccak256(
            ["bytes", "bytes"],
            [deposit0.toStateLeaf(), deposit1.toStateLeaf()]
        );

        const txDeposit0 = await depositManager.depositFor(
            0,
            amount.l1Value,
            tokenID
        );
        console.log(
            "Deposit 0 transaction cost",
            (await txDeposit0.wait()).gasUsed.toNumber()
        );

        const [event0] = await depositManager.queryFilter(
            depositManager.filters.DepositQueued(),
            txDeposit0.blockHash
        );

        const event0State = State.fromDepositQueuedEvent(event0);
        assert.equal(event0State.hash(), deposit0.hash());
        assert.equal(event0.args.subtreeID.toNumber(), 1);
        assert.equal(event0.args.depositID.toNumber(), 0);

        const txDeposit1 = await depositManager.depositFor(
            1,
            amount.l1Value,
            tokenID
        );
        console.log(
            "Deposit 1 transaction cost",
            (await txDeposit1.wait()).gasUsed.toNumber()
        );
        const [event1] = await depositManager.queryFilter(
            depositManager.filters.DepositQueued(),
            txDeposit1.blockHash
        );

        const event1State = State.fromDepositQueuedEvent(event1);
        assert.equal(event1State.hash(), deposit1.hash());
        assert.equal(event1.args.subtreeID.toNumber(), 1);
        assert.equal(event1.args.depositID.toNumber(), 1);

        const [eventReady] = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(),
            txDeposit1.blockHash
        );
        const subtreeRoot = eventReady.args?.subtreeRoot;
        assert.equal(subtreeRoot, pendingDeposit);

        // Make sure subtreeID increments correctly
        const txDeposit2 = await depositManager.depositFor(
            2,
            amount.l1Value,
            tokenID
        );
        console.log(
            "Deposit 2 transaction cost",
            (await txDeposit2.wait()).gasUsed.toNumber()
        );
        const [event2] = await depositManager.queryFilter(
            depositManager.filters.DepositQueued(),
            txDeposit2.blockHash
        );

        const event2State = State.fromDepositQueuedEvent(event2);
        assert.equal(event2State.hash(), deposit2.hash());
        assert.equal(event2.args.subtreeID.toNumber(), 2);
        assert.equal(event2.args.depositID.toNumber(), 0);
    });

    it("submit a deposit Batch to rollup", async function() {
        const { depositManager, rollup, blsAccountRegistry } = contracts;

        const stateTree = StateTree.new(TESTING_PARAMS.MAX_DEPTH);

        const vacancyProof = stateTree.getVacancyProof(
            0,
            TESTING_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        const initialCommitment = TransferCommitment.new(
            stateTree.root,
            await blsAccountRegistry.root()
        );
        const initialBatch = initialCommitment.toBatch();
        const initialBatchID = 1;
        await initialBatch.submit(
            rollup,
            initialBatchID,
            TESTING_PARAMS.STAKE_AMOUNT
        );
        const amount = erc20.fromHumanValue("10");

        const stateLeaves = [];
        const nDeposits = 2 ** TESTING_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH;

        for (let i = 0; i < nDeposits; i++) {
            await depositManager.depositFor(i, amount.l1Value, tokenID);
            const state = State.new(i, tokenID, amount.l2Value, 0);
            stateLeaves.push(state.toStateLeaf());
        }
        const nextBatchID = 2;
        await rollup.submitDeposits(
            nextBatchID,
            initialBatch.proofCompressed(0),
            vacancyProof,
            { value: TESTING_PARAMS.STAKE_AMOUNT }
        );
        const batchID = Number(await rollup.nextBatchID()) - 1;
        const depositSubTreeRoot = await rollup.deposits(batchID);
        const root = MemoryTree.merklize(stateLeaves).root;
        assert.equal(depositSubTreeRoot, root);
    });
});
