import { State } from "../../state";
import { stateDB } from "../../client/database/connection";
import { Leaf, LeafFactory } from "./Leaf";
import { LevelUp } from "levelup";

export class StateLeafFactory implements LeafFactory<StateLeaf> {
    constructor(private readonly database: LevelUp) {}

    async create(itemId: number, itemHash: string): Promise<StateLeaf> {
        const key = `stateLeaf${itemId}${itemHash}`;
        const bytes = await this.database.get(key);
        const item = State.fromEncoded(bytes);
        return new StateLeaf(item, itemId);
    }
}
export class StateLeaf extends Leaf<State> {
    name = "stateLeaf";
    db = stateDB;

    deserialize(bytes: string): State {
        return State.fromEncoded(bytes);
    }

    async fromDB(itemID: number, itemHash: string): Promise<StateLeaf> {
        const key = this.getKey(itemID, itemHash);
        const bytes = await this.db.get(key);
        const item = this.deserialize(bytes);
        return new StateLeaf(item, itemID);
    }
}
