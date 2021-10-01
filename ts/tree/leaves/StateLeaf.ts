import { State } from "../../state";
import { Leaf, getLeafKey, LeafFactoryFunc } from "./Leaf";
import { LevelUp } from "levelup";

const stateName = "stateLeaf";

export function StateLeafFactory(db: LevelUp): LeafFactoryFunc<State> {
    const name = stateName;

    const newLeaf = (item: State, itemID: number) => {
        return StateLeaf.new(item, itemID, db);
    };

    const fromDB = async (itemId: number) => {
        return await StateLeaf.fromDB(itemId, db);
    };

    return { name, newLeaf, fromDB };
}

export class StateLeaf extends Leaf<State> {
    name = stateName;

    static new(item: State, itemID: number, db: LevelUp): StateLeaf {
        return new StateLeaf(item, itemID, db);
    }

    static async fromDB(itemId: number, db: LevelUp): Promise<StateLeaf> {
        const key = getLeafKey(stateName, itemId);
        const bytes = await db.get(key);
        const item = State.fromEncoded(bytes);
        return new StateLeaf(item, itemId, db);
    }

    static fromState(state: State, itemId: number, db: LevelUp) {
        return new StateLeaf(state, itemId, db);
    }
}
