import { State } from "../../state";
import { StateLeafFactory } from "../../tree/leaves/StateLeaf";
import { StorageEngine } from "../storageEngine/interfaces";
import { Connection } from "./connection";
import { DatabaseEngine } from "./databaseEngine";
import { Pubkey2StatesDB } from "./pubkey2states";

export interface StateStorageEngine extends StorageEngine<State> {}

export class StateDatabaseEngine extends DatabaseEngine<State>
    implements StateStorageEngine {
    constructor(depth: number, public readonly connections: Connection) {
        super(
            depth,
            connections.stateDB,
            StateLeafFactory(connections.stateDB)
        );
    }

    public async updateBatch(
        path: number,
        depth: number,
        items: State[]
    ): Promise<void> {
        for (const [i, item] of items.entries()) {
            const itemID = path * 2 ** depth + i;
            await this.update(itemID, item);
            await Pubkey2StatesDB.update(
                item.pubkeyID.toNumber(),
                itemID,
                this.connections.pubkey2statesDB,
                this.connections.pubkeyDB
            );
        }
    }
}
