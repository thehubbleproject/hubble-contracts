import { Connection } from "../database/connection";
import { BatchStorage } from "./batches/interfaces";
import { PubkeyStorageEngine } from "./pubkeyEngine";
import { StateStorageEngine } from "./stateEngine";
import { TransactionStorage } from "./transactions/interfaces";

/**
 * Manager for all persisted states.
 */
export interface StorageManager {
    pubkey: PubkeyStorageEngine;
    state: StateStorageEngine;
    batches: BatchStorage;
    transactions: TransactionStorage;
    connection: Connection;
}
