import { State } from "../../../state";
import { stateDB } from "../connection";
import { Leaf } from "./Leaf";

export class StateLeaf extends Leaf<State> {
    name = "stateLeaf";
    db = stateDB;

    serialize() {
        return this.item.encode();
    }

    deserialize(bytes: string): State {
        return State.fromEncoded(bytes);
    }
}
