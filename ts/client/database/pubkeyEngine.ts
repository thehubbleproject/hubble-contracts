import { Pubkey } from "../../pubkey";
import { StorageEngine } from "../storageEngine/interfaces";
import { DatabaseEngine } from "./databaseEngine";

export interface PubkeyStorageEngine extends StorageEngine<Pubkey> {}

export class PubkeyDatabaseEngine extends DatabaseEngine<Pubkey>
    implements PubkeyStorageEngine {}
