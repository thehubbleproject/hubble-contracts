import { Pubkey } from "../../pubkey";
import { StorageEngine } from "./interfaces";
import { MemoryEngine } from "./memoryEngine";

export interface PubkeyStorageEngine extends StorageEngine<Pubkey> {}
export class PubkeyMemoryEngine extends MemoryEngine<Pubkey>
    implements PubkeyStorageEngine {}
