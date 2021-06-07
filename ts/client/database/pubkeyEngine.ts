import { Pubkey } from "../../pubkey";
import { PubkeyLeaf, PubkeyLeafFactory } from "../../tree/leaves/PubkeyLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { DatabaseEngine } from "./databaseEngine";

export interface PubkeyStorageEngine
    extends StorageEngine<Pubkey, PubkeyLeaf, PubkeyLeafFactory> {}

export class PubkeyDatabaseEngine
    extends DatabaseEngine<Pubkey, PubkeyLeaf, PubkeyLeafFactory>
    implements PubkeyStorageEngine {}
