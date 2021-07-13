import { Batch } from "../../features/interface";

export type BatchL1Transaction = {
    hash: string;
};

/**
 * Cache of batches
 */
export interface BatchStorage {
    /**
     * Adds a batch.
     *
     * @param batch The batch to add.
     * @param l1Txn (optional) L1 transaction data associated with the batch.
     *
     * @returns The added batch's batchID.
     */
    add(batch: Batch, l1Txn: BatchL1Transaction): Promise<number>;
    /**
     * @returns Current number of batches.
     */
    count(): number;
    /**
     * Gets a batch by its numeric ID.
     *
     * @param id The batch ID
     */
    getByID(id: number): Promise<Batch | undefined>;
    /**
     * Gets a batch by its commitmentRoot.
     *
     * @param commitmentRoot Root of the batch.
     */
    getByCommitmentRoot(commitmentRoot: string): Promise<Batch | undefined>;
    /**
     * Gets the previous batch.
     */
    previous(): Promise<Batch | undefined>;
    /**
     * Get the current batch.
     */
    current(): Promise<Batch | undefined>;
    /**
     * Gets the previous batch ID.
     */
    previousBatchID(): Promise<number>;
    /**
     * Gets the current batch ID.
     */
    currentBatchID(): Promise<number>;
    /**
     * Gets the next batch ID.
     */
    nextBatchID(): Promise<number>;
    /**
     * Rolls back to the specified batch, and returns all
     * batches removed.
     *
     * @param commitmentRoot Root of the batch to roll back to.
     */
    rollbackTo(commitmentRoot: string): Promise<Batch[]>;
    /**
     * Get L1 transaction data assocaited with a batch.
     *
     * @param commitmentRoot Root of the batch.
     */
    getL1Transaction(
        commitmentRoot: string
    ): Promise<BatchL1Transaction | undefined>;
}
