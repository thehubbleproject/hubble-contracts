import { State } from "../../state";
import { StateLeaf, StateLeafFactory } from "../../tree/leaves/StateLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { DatabaseEngine } from "./databaseEngine";

export interface StateStorageEngine
    extends StorageEngine<State, StateLeaf, StateLeafFactory> {}

export class StateDatabaseEngine
    extends DatabaseEngine<State, StateLeaf, StateLeafFactory>
    implements StateStorageEngine {}
