import { State } from "../../state";
import { StateLeaf } from "../../tree/leaves/StateLeaf";
import { StateStorageEngine } from "../storageEngine";
import { DatabaseEngine } from "./databaseEngine";

export class StateDatabaseEngine extends DatabaseEngine<State, StateLeaf>
    implements StateStorageEngine {
    constructor(depth: number) {
        super(depth, StateLeaf.fromDB);
    }
}
