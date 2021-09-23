import { OffchainTx } from "../../features/interface";
import { Status } from "./constants";

/**
 * Represents the status of an L2 transaction.
 */
export type TransactionStatus = Readonly<{
    transaction: OffchainTx;
    status: Status;
    detail?: string;
    batchID?: number;
    l1TxnHash?: string;
    l1BlockIncluded?: number;
}>;

export type SubmitMeta = NonNullable<
    Pick<TransactionStatus, "batchID" | "l1TxnHash" | "l1BlockIncluded">
>;

export type SyncMeta = SubmitMeta & {
    finalized: boolean;
};

export type TransationMessageOrObject = string | OffchainTx;

/**
 * Cache of L2 transactions and their status.
 * Note that currently this only supports Transfer transactions.
 * It can be adapted in the future to support others.
 *
 * The message used to identify the txn will be normally be either:
 * - OffchainTx.message()
 * - CompressedTx.message(nonce)
 *
 * Note that txns use BLS signitures. So for a given message, the
 * signiture from the same private key will always be the same.
 * This is in contrast to ECDSA.
 */
export interface TransactionStorage {
    /**
     * Gets a Hubble L2 transaction.
     *
     * @param message Message or object of the L2 transaction.
     */
    get(
        msgOrTxn: TransationMessageOrObject
    ): Promise<TransactionStatus | undefined>;
    /**
     * Adds a transaction in a pending state. This represents an
     * L2 transaction that has not yet been submitted in a batch.
     *
     * @param txn Txn to add.
     */
    pending(txn: OffchainTx): Promise<TransactionStatus>;
    /**
     * Transitions a pending transaction to being submitted
     * in an L1 txn (batch submission).
     *
     * @param message Message or object of the L2 transaction.
     * @param meta Metadata about the submission, including batch and L1 txn info.
     */
    submitted(
        msgOrTxn: TransationMessageOrObject,
        meta: SubmitMeta
    ): Promise<TransactionStatus>;
    /**
     * Transitions a submitted transaction to finalized when the batch
     * it is included in has been finalized.
     *
     * @param message Message or object of the L2 transaction.
     */
    finalized(msgOrTxn: TransationMessageOrObject): Promise<TransactionStatus>;
    /**
     * Transitions a transaction to failed state.
     *
     * @param message Message or object of the L2 transaction.
     * @param detail Reason why the transaction failed.
     */
    failed(
        msgOrTxn: TransationMessageOrObject,
        detail: string
    ): Promise<TransactionStatus>;
    /**
     * Syncs a transactions status from L1 state.
     *
     * @param txn The transaction to sync.
     * @param meta Metadata associated with the transaction.
     */
    sync(txn: OffchainTx, meta: SyncMeta): Promise<TransactionStatus>;
    /**
     * @returns Current number of transactions.
     */
    count(): Promise<number>;
}
