import { PubkeyStorageEngine } from "./pubkeyEngine";
import { StateStorageEngine } from "./stateEngine";

/**
 * Manager for all persisted states.
 */
export interface StorageManager {
    pubkey: PubkeyStorageEngine;
    state: StateStorageEngine;
}
