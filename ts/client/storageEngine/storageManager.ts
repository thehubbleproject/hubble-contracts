import { PubkeyStorageEngine } from "./pubkeyEngine";
import { StateStorageEngine } from "./stateEngine";

export interface StorageManager {
    pubkey: PubkeyStorageEngine;
    state: StateStorageEngine;
}
