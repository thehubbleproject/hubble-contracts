import { Batch } from "../../features/interface";
import { BatchL1Transaction, BatchStorage } from "./interfaces";

/**
 * In memory implementation of BatchStorage
 */
export class BatchMemoryStorage implements BatchStorage {
    private readonly orderedBatches: Array<Batch>;
    private readonly commitmentRootToBatchIndex: Record<string, number>;
    private readonly revertedBatches: Array<Batch>;
    private readonly commitmentRootToL1Transaction: Record<
        string,
        BatchL1Transaction
    >;

    constructor() {
        this.orderedBatches = [];
        this.commitmentRootToBatchIndex = {};
        this.revertedBatches = [];
        this.commitmentRootToL1Transaction = {};
    }

    public count(): number {
        return this.orderedBatches.length;
    }

    public async add(batch: Batch, l1Txn: BatchL1Transaction): Promise<number> {
        if (
            this.commitmentRootToBatchIndex[batch.commitmentRoot] !== undefined
        ) {
            throw new Error(
                `batch with commmitmentRoot ${batch.commitmentRoot} already exists`
            );
        }

        this.orderedBatches.push(batch);
        const batchID = await this.currentBatchID();

        this.commitmentRootToBatchIndex[batch.commitmentRoot] = batchID;
        this.commitmentRootToL1Transaction[batch.commitmentRoot] = l1Txn;

        return batchID;
    }

    public async getByID(id: number): Promise<Batch | undefined> {
        return this.orderedBatches[id];
    }

    public async getByCommitmentRoot(
        commitmentRoot: string
    ): Promise<Batch | undefined> {
        const idx = this.commitmentRootToBatchIndex[commitmentRoot];
        return this.orderedBatches[idx];
    }

    public async previous(): Promise<Batch | undefined> {
        const batchID = await this.previousBatchID();
        return this.orderedBatches[batchID];
    }

    public async current(): Promise<Batch | undefined> {
        const batchID = await this.currentBatchID();
        return this.orderedBatches[batchID];
    }

    public async previousBatchID(): Promise<number> {
        const cur = await this.currentBatchID();
        return cur - 1;
    }

    public async currentBatchID(): Promise<number> {
        return this.orderedBatches.length - 1;
    }

    public async nextBatchID(): Promise<number> {
        const cur = await this.currentBatchID();
        return cur + 1;
    }

    public async rollbackTo(commitmentRoot: string): Promise<Batch[]> {
        const idx = this.commitmentRootToBatchIndex[commitmentRoot];
        if (idx == undefined) {
            throw new Error(
                `batch with commmitmentRoot ${commitmentRoot} not found`
            );
        }

        const removedBatches = this.orderedBatches.splice(
            idx + 1,
            this.orderedBatches.length - idx
        );
        this.revertedBatches.push(...removedBatches);
        for (const b of removedBatches) {
            delete this.commitmentRootToBatchIndex[b.commitmentRoot];
        }
        return removedBatches;
    }

    public async getL1Transaction(
        commitmentRoot: string
    ): Promise<BatchL1Transaction | undefined> {
        return this.commitmentRootToL1Transaction[commitmentRoot];
    }
}
