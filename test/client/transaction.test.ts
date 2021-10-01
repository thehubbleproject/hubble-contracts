import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import del from "del";
import { BlsSigner } from "../../ts/blsSigner";
import { OffchainTx } from "../../ts/client/features/interface";
import { TransferOffchainTx } from "../../ts/client/features/transfer";
import { Status } from "../../ts/client/storageEngine/transactions/constants";
import { TransactionDBStorage } from "../../ts/client/storageEngine/transactions/db";
import {
    StatusTransitionInvalid,
    TransactionAlreadyExists,
    TransactionDoesNotExist
} from "../../ts/exceptions";
import * as mcl from "../../ts/mcl";
import { randHex } from "../../ts/utils";

chai.use(chaiAsPromised);

const txFactory = (
    fromIndex: number,
    toIndex: number,
    amount: number,
    fee: number,
    nonce: number
): OffchainTx => {
    const tx = new TransferOffchainTx(
        BigNumber.from(fromIndex),
        BigNumber.from(toIndex),
        BigNumber.from(amount),
        BigNumber.from(fee),
        BigNumber.from(nonce)
    );
    const signer = BlsSigner.new(arrayify(randHex(32)));
    tx.signature = signer.sign(tx.message());
    return tx;
};

describe("TransactionDBStorage", () => {
    let storage = new TransactionDBStorage();

    before(async function() {
        await del("./leveldb/*");
        await mcl.init();
    });

    describe("get", () => {
        it("throws error if transaction has not been added", async function() {
            assert.isRejected(
                storage.get("abc123"),
                /.*Key not found in database*/
            );
        });

        it("returns the correct transaction", async function() {
            const fee = 1;
            const txns = [
                txFactory(0, 1, 123, fee, 0),
                txFactory(2, 3, 456, fee, 0)
            ];

            await Promise.all(txns.map(async t => storage.pending(t)));

            assert.equal(await storage.count(), 2);

            for (const t of txns) {
                const txnStatus = await storage.get(t.message());
                assert.equal(txnStatus?.transaction.hash(), t.hash());
                const txnStatusFromTx = await storage.get(t);
                assert.equal(txnStatusFromTx?.transaction.hash(), t.hash());
            }
        });
    });

    describe("transaction lifecycle", () => {
        describe("succeeds", () => {
            it("properly transitions to finalized", async function() {
                const txn = txFactory(4, 5, 1337, 42, 0);
                const txnMsg = txn.message();

                const pendingStatus = await storage.pending(txn);
                assert.equal(pendingStatus.transaction.hash(), txn.hash());
                assert.equal(pendingStatus.status, Status.Pending);

                const meta = {
                    batchID: 789,
                    l1TxnHash: "def456",
                    l1BlockIncluded: 101112
                };
                const submittedStatus = await storage.submitted(txnMsg, meta);
                assert.equal(submittedStatus.transaction.hash(), txn.hash());
                assert.equal(submittedStatus.status, Status.Submitted);
                assert.equal(submittedStatus.batchID, meta.batchID);
                assert.equal(submittedStatus.l1TxnHash, meta.l1TxnHash);
                assert.equal(
                    submittedStatus.l1BlockIncluded,
                    meta.l1BlockIncluded
                );

                const finalizedStatus = await storage.finalized(txnMsg);
                assert.equal(finalizedStatus.transaction.hash(), txn.hash());
                assert.equal(finalizedStatus.status, Status.Finalized);
                assert.equal(finalizedStatus.batchID, meta.batchID);
                assert.equal(finalizedStatus.l1TxnHash, meta.l1TxnHash);
                assert.equal(
                    finalizedStatus.l1BlockIncluded,
                    meta.l1BlockIncluded
                );
            });

            it("properly transitions to failed state from pending", async function() {
                const txn = txFactory(10, 11, 1010, 101, 0);
                await storage.pending(txn);

                const detail = "whoops";
                const failedStatus = await storage.failed(
                    txn.message(),
                    detail
                );
                assert.equal(failedStatus.transaction.hash(), txn.hash());
                assert.equal(failedStatus.status, Status.Failed);
                assert.equal(failedStatus.detail, detail);
            });

            it("properly transitions to failed state from submitted", async function() {
                const txn = txFactory(11, 12, 2020, 202, 0);
                await storage.pending(txn);
                const meta = {
                    batchID: 111,
                    l1TxnHash: "aaa111",
                    l1BlockIncluded: 111111
                };
                await storage.submitted(txn.message(), meta);

                const detail = "uh-oh";
                const failedStatus = await storage.failed(
                    txn.message(),
                    detail
                );
                assert.equal(failedStatus.transaction.hash(), txn.hash());
                assert.equal(failedStatus.status, Status.Failed);
                assert.equal(failedStatus.detail, detail);
            });
        });

        describe("fails", () => {
            it("when already added", async function() {
                const txn = txFactory(6, 7, 111, 22, 0);
                await storage.pending(txn);
                await assert.isRejected(
                    storage.pending(txn),
                    TransactionAlreadyExists
                );
            });

            it("when not found", async function() {
                const missingMessage = "ghi789";
                const meta = {
                    batchID: 321,
                    l1TxnHash: "zyx987",
                    l1BlockIncluded: 131415
                };
                await assert.isRejected(
                    storage.submitted(missingMessage, meta),
                    TransactionDoesNotExist
                );
                await assert.isRejected(
                    storage.finalized(missingMessage),
                    TransactionDoesNotExist
                );
                await assert.isRejected(
                    storage.failed(missingMessage, "derp"),
                    TransactionDoesNotExist
                );
            });

            it("when transitioning to an improper state", async function() {
                const txn = txFactory(9, 0, 420, 69, 0);
                const txnMsg = txn.message();
                await storage.pending(txn);

                await assert.isRejected(
                    storage.finalized(txnMsg),
                    StatusTransitionInvalid
                );

                const meta = {
                    batchID: 654,
                    l1TxnHash: "xyz789",
                    l1BlockIncluded: 161718
                };
                await storage.submitted(txnMsg, meta);

                await assert.isRejected(
                    storage.submitted(txnMsg, meta),
                    StatusTransitionInvalid
                );

                await storage.finalized(txnMsg);
                await assert.isRejected(
                    storage.finalized(txnMsg),
                    StatusTransitionInvalid
                );
                await assert.isRejected(
                    storage.submitted(txnMsg, meta),
                    StatusTransitionInvalid
                );
                await assert.isRejected(
                    storage.failed(txnMsg, ""),
                    StatusTransitionInvalid
                );
            });
        });
    });

    describe("sync", () => {
        it("fails if transaction already exists", async function() {
            const txn = txFactory(111, 112, 421, 70, 0);
            await storage.pending(txn);

            const meta = {
                finalized: false,
                batchID: 765,
                l1TxnHash: "abc980",
                l1BlockIncluded: 11112222
            };

            await assert.isRejected(
                storage.sync(txn, meta),
                TransactionAlreadyExists
            );
        });

        it("successfully syncs a submitted transaction", async function() {
            const txn = txFactory(111, 222, 543, 65, 1);
            const meta = {
                batchID: 999,
                l1TxnHash: "zzz999",
                l1BlockIncluded: 999000
            };

            const status = await storage.sync(txn, {
                ...meta,
                finalized: false
            });

            assert.equal(status.transaction.hash(), txn.hash());
            assert.equal(status.status, Status.Submitted);
            assert.equal(status.batchID, meta.batchID);
            assert.equal(status.l1TxnHash, meta.l1TxnHash);
            assert.equal(status.l1BlockIncluded, meta.l1BlockIncluded);
        });

        it("successfully syncs a finalized transaction", async function() {
            const txn = txFactory(111, 333, 345, 56, 0);
            const meta = {
                batchID: 111,
                l1TxnHash: "aaa111",
                l1BlockIncluded: 111
            };

            const status = await storage.sync(txn, {
                ...meta,
                finalized: true
            });

            assert.equal(status.transaction.hash(), txn.hash());
            assert.equal(status.status, Status.Finalized);
            assert.equal(status.batchID, meta.batchID);
            assert.equal(status.l1TxnHash, meta.l1TxnHash);
            assert.equal(status.l1BlockIncluded, meta.l1BlockIncluded);
        });
    });
});
