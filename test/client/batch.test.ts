import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import {
    Batch,
    Commitment,
    CommitmentInclusionProof
} from "../../ts/client/features/interface";
import {
    BatchL1Transaction,
    BatchStorage
} from "../../ts/client/storageEngine/batches/interfaces";
import { BatchMemoryStorage } from "../../ts/client/storageEngine/batches/memory";

chai.use(chaiAsPromised);

class TestBatch implements Batch {
    public readonly commitments: Commitment[];

    constructor(public readonly commitmentRoot: string) {
        this.commitments = [];
    }

    public proofCompressed(_leafIndex: number): CommitmentInclusionProof {
        throw new Error("TestBatch: proofCompressed not implemented");
    }

    public toString(): string {
        throw new Error("TestBatch: toString not implemented");
    }
}

describe("BatchMemoryStorage", () => {
    let batches: Array<Batch>;
    let l1Txn: BatchL1Transaction;
    let storage: BatchStorage;

    before(function() {
        batches = [];
        for (let i = 0; i < 5; i++) {
            batches.push(new TestBatch(`fakeCommitmentRoot${i}`));
        }
        l1Txn = { hash: "0x123456" };
    });

    beforeEach(function() {
        storage = new BatchMemoryStorage();
    });

    describe("add", () => {
        it("fails if batch was already added", async function() {
            await storage.add(batches[0], l1Txn);
            await assert.isRejected(storage.add(batches[0], l1Txn));
        });

        it("multiple batches suceeds", async function() {
            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], l1Txn);

            assert.equal(await storage.getByID(0), batches[0]);
            assert.equal(await storage.getByID(1), batches[1]);
        });
    });

    describe("count", () => {
        it("returns 0 with no batches", async function() {
            assert.equal(storage.count(), 0);
        });

        it("returns number of batches added", async function() {
            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], l1Txn);

            assert.equal(storage.count(), 2);
        });
    });

    describe("getByID", () => {
        it("returns undefined if batch not added", async function() {
            assert.isUndefined(await storage.getByID(0));
        });

        it("returns correct batch", async function() {
            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], l1Txn);
            await storage.add(batches[2], l1Txn);

            assert.equal(await storage.getByID(1), batches[1]);
        });
    });

    describe("getByCommitmentRoot", () => {
        it("returns undefined if batch not added", async function() {
            assert.isUndefined(
                await storage.getByCommitmentRoot(batches[0].commitmentRoot)
            );
        });

        it("returns correct batch", async function() {
            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], l1Txn);
            await storage.add(batches[2], l1Txn);

            assert.equal(
                await storage.getByCommitmentRoot(batches[1].commitmentRoot),
                batches[1]
            );
        });
    });

    describe("previous", () => {
        it("returns undefined if batch not added", async function() {
            assert.isUndefined(await storage.previous());
        });

        it("returns undefined if one batch added", async function() {
            await storage.add(batches[0], l1Txn);

            assert.isUndefined(await storage.previous());
        });

        it("returns correct previous batch", async function() {
            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], l1Txn);

            assert.equal(await storage.previous(), batches[0]);
        });
    });

    describe("current", () => {
        it("returns undefined if batch not added", async function() {
            assert.isUndefined(await storage.current());
        });

        it("returns last added batch", async function() {
            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], l1Txn);

            assert.equal(await storage.current(), batches[1]);
        });
    });

    describe("previous, current, next Batch ID", () => {
        it("have correct initial values", async function() {
            assert.equal(await storage.previousBatchID(), -2);
            assert.equal(await storage.currentBatchID(), -1);
            assert.equal(await storage.nextBatchID(), 0);
        });

        it("update when new batches are added", async function() {
            await storage.add(batches[0], l1Txn);

            assert.equal(await storage.previousBatchID(), -1);
            assert.equal(await storage.currentBatchID(), 0);
            assert.equal(await storage.nextBatchID(), 1);

            await storage.add(batches[1], l1Txn);

            assert.equal(await storage.previousBatchID(), 0);
            assert.equal(await storage.currentBatchID(), 1);
            assert.equal(await storage.nextBatchID(), 2);

            await storage.add(batches[2], l1Txn);

            assert.equal(await storage.previousBatchID(), 1);
            assert.equal(await storage.currentBatchID(), 2);
            assert.equal(await storage.nextBatchID(), 3);
        });
    });

    describe("rollbackTo", () => {
        it("fails if batch not found", async function() {
            await assert.isRejected(
                storage.rollbackTo(batches[0].commitmentRoot)
            );
        });

        it("returns empty array if commitmentRoot is latest batch", async function() {
            await storage.add(batches[0], l1Txn);

            assert.lengthOf(
                await storage.rollbackTo(batches[0].commitmentRoot),
                0
            );
        });

        it("rolls back and returns removed batches", async function() {
            for (const b of batches) {
                await storage.add(b, l1Txn);
            }

            assert.equal(storage.count(), batches.length);
            assert.equal(await storage.current(), batches[4]);
            assert.equal(await storage.previous(), batches[3]);

            const removedBatches = await storage.rollbackTo(
                batches[2].commitmentRoot
            );

            assert.lengthOf(removedBatches, 2);
            assert.equal(removedBatches[0], batches[3]);
            assert.equal(removedBatches[1], batches[4]);

            assert.equal(storage.count(), 3);
            assert.equal(await storage.current(), batches[2]);
            assert.equal(await storage.previous(), batches[1]);
        });
    });

    describe("getL1Transaction", () => {
        it("returns undefined if no batch added", async function() {
            assert.isUndefined(await storage.getL1Transaction("abc123"));
        });

        it("returns correct L1 transaction metadata", async function() {
            const anotherL1Txn = { hash: "0x456789 " };

            await storage.add(batches[0], l1Txn);
            await storage.add(batches[1], anotherL1Txn);
            await storage.add(batches[2], anotherL1Txn);
            await storage.add(batches[3], l1Txn);

            assert.equal(
                await storage.getL1Transaction(batches[0].commitmentRoot),
                l1Txn
            );
            assert.equal(
                await storage.getL1Transaction(batches[1].commitmentRoot),
                anotherL1Txn
            );
            assert.equal(
                await storage.getL1Transaction(batches[2].commitmentRoot),
                anotherL1Txn
            );
            assert.equal(
                await storage.getL1Transaction(batches[3].commitmentRoot),
                l1Txn
            );
        });
    });
});
