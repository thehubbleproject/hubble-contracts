import { State } from "../../state";
import { StateLeaf } from "../../tree/leaves/StateLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { DatabaseEngine } from "./databaseEngine";

export interface StateStorageEngine extends StorageEngine<State, StateLeaf> {}

export class StateDatabaseEngine extends DatabaseEngine<State, StateLeaf>
    implements StateStorageEngine {}
