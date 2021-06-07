import { State } from "../../state";
import { stateDB } from "../../client/database/connection";
import { Leaf } from "./Leaf";

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
