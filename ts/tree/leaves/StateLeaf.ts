import { State } from "../../state";
import { stateDB } from "../../client/database/connection";
import { Leaf, getLeafKey } from "./Leaf";

const stateName = "stateLeaf";

export class StateLeaf extends Leaf<State> {
    name = stateName;
    db = stateDB;

    static async fromDB(itemId: number, itemHash: string): Promise<StateLeaf> {
        const key = getLeafKey(stateName, itemId);
        const bytes = await stateDB.get(key);
        const item = State.fromEncoded(bytes);
        return new StateLeaf(item, itemId);
    }

    static fromState(state: State, itemId: number) {
        return new StateLeaf(state, itemId);
    }
}
