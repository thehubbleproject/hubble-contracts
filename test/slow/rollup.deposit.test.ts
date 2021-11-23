import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { serialize } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { allContracts } from "../../ts/allContractsInterfaces";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { getGenesisProof, TransferCommitment } from "../../ts/commitments";
import { ERC20ValueFactory, USDT } from "../../ts/decimal";
import { hexToUint8Array } from "../../ts/utils";
import { Group, txTransferFactory } from "../../ts/factory";
import { deployKeyless } from "../../ts/deployment/deploy";
import { handleNewBatch } from "../../ts/client/features/deposit";
import { Batch } from "../../ts/client/features/interface";
import { BigNumberish } from "ethers";
import { State } from "../../ts/state";

chai.use(chaiAsPromised);

const DOMAIN = hexToUint8Array(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

describe("Rollup Deposit", async function() {
    const tokenID = 0;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let users: Group;
    let genesisRoot: string;
    let erc20: ERC20ValueFactory;

    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();

        users = Group.new({
            n: 32,
            initialStateID: 0,
            initialPubkeyID: 0,
            domain: DOMAIN
        });

        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);

        const initialBalance = USDT.fromHumanValue("55.6").l2Value;
        users
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: true });

        genesisRoot = stateTree.root;

        await deployKeyless(signer, false);
        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            BLOCKS_TO_FINALISE: 10,
            GENESIS_STATE_ROOT: genesisRoot
        });

        registry = await AccountRegistry.new(contracts.blsAccountRegistry);

        for (const user of users.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }

        const { exampleToken, depositManager } = contracts;
        erc20 = new ERC20ValueFactory(await exampleToken.decimals());
        await exampleToken.approve(
            depositManager.address,
            erc20.fromHumanValue("1000000").l1Value
        );
    });

    it("reenqueue deposit subtree on rollback", async function() {
        const feeReceiver = users.getUser(0).stateID;
        const { rollup, depositManager } = contracts;
        const { txs, signature } = txTransferFactory(
            users,
            TESTING_PARAMS.MAX_TXS_PER_COMMIT
        );

        const postBatchStateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const commitment = TransferCommitment.new(
            postBatchStateTree.root,
            registry.root(),
            signature,
            feeReceiver,
            serialize(txs)
        );

        const targetBatch = commitment.toBatch();
        const transferBatchID = 1;
        const _txSubmit = await targetBatch.submit(
            rollup,
            transferBatchID,
            TESTING_PARAMS.STAKE_AMOUNT
        );
        await _txSubmit.wait();

        const subtreeRoots = await submitTwoDepositBatches(
            targetBatch,
            2,
            postBatchStateTree,
            0
        );

        const { proofs } = stateTree.processTransferCommit(txs, feeReceiver);
        const _tx = await rollup.disputeTransitionTransfer(
            transferBatchID,
            getGenesisProof(genesisRoot),
            targetBatch.proof(0),
            proofs,
            { gasLimit: 10000000 }
        );
        const receipt = await _tx.wait();
        console.log("disputeBatch execution cost", receipt.gasUsed.toNumber());

        for (let i = 0; i < subtreeRoots.length; i++) {
            const root = await depositManager.queue(i + 1);
            assert.equal(root, subtreeRoots[i]);
        }
    }).timeout(120000);

    async function submitTwoDepositBatches(
        previousBatch: Batch,
        batchID: number,
        stateTree: StateTree,
        startStateID: number
    ): Promise<string[]> {
        const submitResult1 = await submitDepositBatch(
            previousBatch,
            batchID,
            stateTree,
            startStateID
        );

        const submitResult2 = await submitDepositBatch(
            submitResult1.batch,
            batchID + 1,
            stateTree,
            startStateID + 4
        );

        return [submitResult1.subtreeRoot, submitResult2.subtreeRoot];
    }

    async function submitDepositBatch(
        previousBatch: Batch,
        batchID: BigNumberish,
        stateTree: StateTree,
        startStateID: number
    ): Promise<{
        subtreeRoot: string;
        batch: Batch;
    }> {
        const { depositManager, rollup } = contracts;

        const amount = erc20.fromHumanValue("10");

        const vacancyProof = stateTree.getVacancyProof(
            startStateID,
            TESTING_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        const nDeposits = 2 ** TESTING_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH;
        for (let i = 0; i < nDeposits; i++) {
            await depositManager.depositFor(i, amount.l1Value, tokenID);
            const state = State.new(i, tokenID, amount.l2Value, 0);
            stateTree.createState(startStateID + i, state);
        }
        const _txSubmit = await rollup.submitDeposits(
            batchID,
            previousBatch.proofCompressed(0),
            vacancyProof,
            { value: TESTING_PARAMS.STAKE_AMOUNT }
        );
        await _txSubmit.wait();

        const [event] = await rollup.queryFilter(
            rollup.filters.NewBatch(null, null, null),
            _txSubmit.blockHash
        );
        return {
            subtreeRoot: await rollup.deposits(2),
            batch: await handleNewBatch(event, rollup)
        };
    }
});
