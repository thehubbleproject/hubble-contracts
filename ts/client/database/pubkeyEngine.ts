import { Pubkey } from "../../pubkey";
import { PubkeyLeaf } from "../../tree/leaves/PubkeyLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { DatabaseEngine } from "./databaseEngine";

export interface PubkeyStorageEngine
    extends StorageEngine<Pubkey, PubkeyLeaf> {}

export class PubkeyDatabaseEngine extends DatabaseEngine<Pubkey, PubkeyLeaf>
    implements PubkeyStorageEngine {}
