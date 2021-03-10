import { ethers } from "hardhat";
import { assert } from "chai";
import { constants } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { allContracts } from "../../ts/allContractsInterfaces";
import { TESTING_PARAMS } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { State } from "../../ts/state";
import { Tree } from "../../ts/tree";
import { randomLeaves } from "../../ts/utils";
import { TestDepositCore } from "../../types/ethers-contracts/TestDepositCore";
import { TestDepositCoreFactory } from "../../types/ethers-contracts/TestDepositCoreFactory";
import { TransferCommitment } from "../../ts/commitments";
import { StateTree } from "../../ts/stateTree";
import { ERC20ValueFactory } from "../../ts/decimal";
import { DepositPool } from "../../ts/client/features/deposit";

describe("Deposit Core", async function() {
    let contract: TestDepositCore;
    const maxSubtreeDepth = 4;
    before(async function() {
        const [signer] = await ethers.getSigners();
        contract = await new TestDepositCoreFactory(signer).deploy(
            maxSubtreeDepth
        );
    });
    it("insert and merge many deposits", async function() {
        for (let j = 0; j < 5; j++) {
            const maxSubtreeSize = 2 ** maxSubtreeDepth;
            const leaves = randomLeaves(maxSubtreeSize);
            const tree = Tree.new(maxSubtreeDepth);
            for (let i = 0; i < maxSubtreeSize; i++) {
                const gasCost = await contract.callStatic.testInsertAndMerge(
                    leaves[i]
                );
                console.log(
                    `Insert leaf ${i} \t Operation cost: ${gasCost.toNumber()}`
                );
                const tx = await contract.testInsertAndMerge(leaves[i]);
                const events = await contract.queryFilter(
                    contract.filters.DepositSubTreeReady(null, null),
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
                    assert.equal(events[0].args?.subtreeID, j + 1);
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
    it("should allow depositing 2 leaves in a subtree and merging it", async function() {
        const { depositManager } = contracts;
        const pool = new DepositPool(
            Number(await depositManager.paramMaxSubtreeSize())
        );
        const amount = erc20.fromHumanValue("10");
        const deposit0 = State.new(0, tokenID, amount.l2Value, 0);
        const deposit1 = State.new(1, tokenID, amount.l2Value, 0);
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
            depositManager.filters.DepositQueued(null, null),
            txDeposit0.blockHash
        );

        assert.equal(event0.args?.pubkeyID.toNumber(), 0);
        assert.equal(event0.args?.data, deposit0.encode());
        pool.pushDeposit(event0.args?.data);

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
            depositManager.filters.DepositQueued(null, null),
            txDeposit1.blockHash
        );

        assert.equal(event1.args?.pubkeyID.toNumber(), 1);
        assert.equal(event1.args?.data, deposit1.encode());
        pool.pushDeposit(event1.args?.data);

        const [eventReady] = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(null, null),
            txDeposit1.blockHash
        );
        const subtreeRoot = eventReady.args?.subtreeRoot;
        assert.equal(subtreeRoot, pendingDeposit);
        const { root } = pool.popDepositSubtree();
        assert.equal(root, subtreeRoot);
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
        await initialBatch.submit(rollup, TESTING_PARAMS.STAKE_AMOUNT);
        const amount = erc20.fromHumanValue("10");

        const stateLeaves = [];
        const nDeposits = 1 << TESTING_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH;

        for (let i = 0; i < nDeposits; i++) {
            await depositManager.depositFor(i, amount.l1Value, tokenID);
            const state = State.new(i, tokenID, amount.l2Value, 0);
            stateLeaves.push(state.toStateLeaf());
        }
        await rollup.submitDeposits(
            initialBatch.proofCompressed(0),
            vacancyProof,
            { value: TESTING_PARAMS.STAKE_AMOUNT }
        );
        const batchID = Number(await rollup.nextBatchID()) - 1;
        const depositSubTreeRoot = await rollup.deposits(batchID);
        const root = Tree.merklize(stateLeaves).root;
        assert.equal(depositSubTreeRoot, root);
    });
});
