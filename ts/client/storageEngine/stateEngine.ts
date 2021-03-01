import { State } from "../../state";
import { StorageEngine } from "./interfaces";
import { MemoryEngine } from "./memoryEngine";

export interface StateStorageEngine extends StorageEngine<State> {}
export class StateMemoryEngine extends MemoryEngine<State>
    implements StateStorageEngine {}
