import { Pubkey } from "../../pubkey";
import { PubkeyLeaf } from "../../tree/leaves/PubkeyLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { DatabaseEngine } from "./databaseEngine";

export interface PubkeyStorageEngine extends StorageEngine<Pubkey> {}

export class PubkeyDatabaseEngine extends DatabaseEngine<Pubkey>
    implements PubkeyStorageEngine {
    constructor(depth: number) {
        super(depth, PubkeyLeaf.fromDB);
    }
}
