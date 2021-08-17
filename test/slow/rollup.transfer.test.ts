import { flatten } from "lodash";
import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { getAggregateSig, serialize, TxTransfer } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { allContracts } from "../../ts/allContractsInterfaces";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { getGenesisProof, TransferCommitment } from "../../ts/commitments";
import { float16, USDT } from "../../ts/decimal";
import { hexToUint8Array } from "../../ts/utils";
import { Group, txTransferFactory, User } from "../../ts/factory";
import { deployKeyless } from "../../ts/deployment/deploy";
import { handleNewBatch } from "../../ts/client/batchHandler";
import { BigNumber } from "ethers";
import { Result } from "../../ts/interfaces";

chai.use(chaiAsPromised);

const DOMAIN = hexToUint8Array(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

class BadCompressionTxTransfer extends TxTransfer {
    constructor() {
        super(0, 0, BigNumber.from(0), BigNumber.from(0), 0);
    }

    public encode(): string {
        return "0x1337";
    }
}

describe("Rollup Transfer", async function() {
    const tokenID = 1;
    const initialBalance = USDT.fromHumanValue("55.6").l2Value;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let users: Group;
    let genesisRoot: string;
    let feeReceiver: number;

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

        users
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: true });

        const user0 = users.getUser(0);
        feeReceiver = user0.stateID;

        genesisRoot = stateTree.root;

        await deployKeyless(signer, false);
        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: genesisRoot
        });

        registry = await AccountRegistry.new(contracts.blsAccountRegistry);

        for (const user of users.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }
    });

    describe("submit", () => {
        it("fails if batchID is incorrect", async function() {
            const { txs, signature } = txTransferFactory(
                users,
                TESTING_PARAMS.MAX_TXS_PER_COMMIT
            );

            const commit = TransferCommitment.new(
                stateTree.root,
                registry.root(),
                signature,
                feeReceiver,
                serialize(txs)
            );
            const batch = commit.toBatch();

            const invalidBatchID = 666;
            await assert.isRejected(
                batch.submit(
                    contracts.rollup,
                    invalidBatchID,
                    TESTING_PARAMS.STAKE_AMOUNT
                ),
                /.*batchID does not match nextBatchID.*/
            );
        });

        it("submit a batch and dispute", async function() {
            const { rollup } = contracts;
            const { txs, signature } = txTransferFactory(
                users,
                TESTING_PARAMS.MAX_TXS_PER_COMMIT
            );

            const { proofs } = stateTree.processTransferCommit(
                txs,
                feeReceiver
            );

            const commitment = TransferCommitment.new(
                stateTree.root,
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
            const _txSubmitReceipt = await _txSubmit.wait();
            console.log(
                "submitBatch execution cost",
                _txSubmitReceipt.gasUsed.toNumber()
            );

            const [event] = await rollup.queryFilter(
                rollup.filters.NewBatch(),
                _txSubmit.blockHash
            );
            const parsedBatch = await handleNewBatch(event, rollup);
            const batchID = event.args?.batchID;

            assert.equal(
                parsedBatch.commitmentRoot,
                targetBatch.commitmentRoot,
                "mismatch commitment tree root"
            );
            const previousMP = getGenesisProof(genesisRoot);
            const commitmentMP = targetBatch.proof(0);

            const _tx = await rollup.disputeTransitionTransfer(
                batchID,
                previousMP,
                commitmentMP,
                proofs
            );
            const receipt = await _tx.wait();
            console.log(
                "disputeBatch execution cost",
                receipt.gasUsed.toNumber()
            );
            assert.equal(
                (await rollup.invalidBatchMarker()).toNumber(),
                0,
                "Good state transition should not rollback"
            );
        }).timeout(120000);
    });

    describe("disputeTransitionTransfer", () => {
        const txFactory = (overrides: Partial<TxTransfer>, signer?: User) => {
            const user0 = users.getUser(0);
            const amount = overrides.amount ?? float16.round(BigNumber.from(1));
            const tx = new TxTransfer(
                overrides.fromIndex ?? user0.stateID,
                overrides.toIndex ?? user0.stateID,
                amount,
                overrides.fee ?? BigNumber.from(0),
                overrides.nonce ?? 0
            );
            const txSigner = signer ?? user0;
            tx.signature = txSigner.sign(tx);
            return tx;
        };

        [
            {
                description: "0 amount",
                txsFactory: () => [
                    txFactory({ amount: float16.round(BigNumber.from(0)) })
                ],
                expectedResult: Result.InvalidTokenAmount
            },
            {
                description: "not enough token balance",
                txsFactory: () => [
                    txFactory({ amount: float16.round(initialBalance.mul(2)) })
                ],
                expectedResult: Result.NotEnoughTokenBalance
            },
            {
                description: "bad compression (encoding)",
                txsFactory: () => {
                    const tx = new BadCompressionTxTransfer();
                    tx.signature = users.getUser(0).sign(tx);
                    return [tx];
                },
                expectedResult: Result.BadCompression
            },
            {
                description: `too many txs in commit (> ${TESTING_PARAMS.MAX_TXS_PER_COMMIT})`,
                txsFactory: () => {
                    const lenTooManyTxs = TESTING_PARAMS.MAX_TXS_PER_COMMIT + 1;
                    const txs = [];
                    while (txs.length < lenTooManyTxs) {
                        txs.push(txFactory({}));
                    }
                    return txs;
                },
                expectedResult: Result.TooManyTx
            },
            {
                description: "non-existant fromIndex",
                txsFactory: () => [txFactory({ fromIndex: users.size + 1 })],
                expectedResult: Result.BadFromIndex
            },
            {
                description: "non-existant toIndex",
                txsFactory: () => [txFactory({ toIndex: users.size + 1 })],
                expectedResult: Result.BadToIndex
            }
        ].forEach(({ description, txsFactory, expectedResult }) => {
            it(`dispute and rollback a bad batch with l2 tx(s) with ${description}`, async function() {
                const { rollup } = contracts;

                const txs = txsFactory();
                const signature = getAggregateSig(txs);

                // Replace with Array.flat once >= es2019 is supported
                const proofs = flatten(
                    txs.map(tx => [
                        stateTree.getState(tx.fromIndex),
                        stateTree.getState(tx.toIndex)
                    ])
                );

                const commitment = TransferCommitment.new(
                    stateTree.root,
                    registry.root(),
                    signature,
                    feeReceiver,
                    serialize(txs)
                );

                const targetBatch = commitment.toBatch();
                const transferBatchID = 1;
                const submitTx = await targetBatch.submit(
                    rollup,
                    transferBatchID,
                    TESTING_PARAMS.STAKE_AMOUNT
                );

                const [event] = await rollup.queryFilter(
                    rollup.filters.NewBatch(),
                    submitTx.blockHash
                );
                const parsedBatch = await handleNewBatch(event, rollup);
                const batchID = event.args?.batchID;

                assert.equal(
                    parsedBatch.commitmentRoot,
                    targetBatch.commitmentRoot,
                    "mismatch commitment tree root"
                );
                const previousMP = getGenesisProof(genesisRoot);
                const commitmentMP = targetBatch.proof(0);

                const disputeL1Txn = await rollup.disputeTransitionTransfer(
                    batchID,
                    previousMP,
                    commitmentMP,
                    proofs
                );

                const invalidBatchMarker = await rollup.invalidBatchMarker();
                assert.equal(invalidBatchMarker.toNumber(), transferBatchID);

                const [rollbackEvent] = await rollup.queryFilter(
                    rollup.filters.RollbackTriggered(),
                    disputeL1Txn.blockHash
                );
                assert.equal(
                    rollbackEvent.args?.batchID.toNumber(),
                    transferBatchID
                );
                assert.equal(rollbackEvent.args?.result, expectedResult);
            });
        });
    });
});
