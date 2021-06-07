import { BatchStorage } from "../storageEngine/batches/interfaces";
import { TransactionStorage } from "../storageEngine/transactions/interfaces";
import { PubkeyStorageEngine } from "./pubkeyEngine";
import { StateStorageEngine } from "./stateEngine";

/**
 * Manager for all persisted states.
 */
export interface StorageManager {
    pubkey: PubkeyStorageEngine;
    state: StateStorageEngine;
    batches: BatchStorage;
    transactions: TransactionStorage;
}
