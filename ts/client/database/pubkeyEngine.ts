import { Pubkey } from "../../pubkey";
import { PubkeyLeaf } from "../../tree/leaves/PubkeyLeaf";
import { PubkeyStorageEngine } from "../storageEngine";
import { DatabaseEngine } from "./databaseEngine";

export class PubkeyDatabaseEngine extends DatabaseEngine<Pubkey, PubkeyLeaf>
    implements PubkeyStorageEngine {
    constructor(depth: number) {
        super(depth, PubkeyLeaf.fromDB);
    }
}
