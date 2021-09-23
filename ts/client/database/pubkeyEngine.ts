import { Pubkey } from "../../pubkey";
import { PubkeyLeafFactory } from "../../tree/leaves/PubkeyLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { Connection } from "./connection";
import { DatabaseEngine } from "./databaseEngine";

export interface PubkeyStorageEngine extends StorageEngine<Pubkey> {}

export class PubkeyDatabaseEngine extends DatabaseEngine<Pubkey>
    implements PubkeyStorageEngine {
    constructor(depth: number, connections: Connection) {
        super(
            depth,
            connections.pubkeyDB,
            PubkeyLeafFactory(connections.pubkeyDB)
        );
    }
}
