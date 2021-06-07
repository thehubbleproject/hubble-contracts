import { State } from "../../state";
import { stateDB } from "../../client/database/connection";
import { Leaf } from "./Leaf";

export class StateLeaf extends Leaf<State> {
    name = "stateLeaf";
    db = stateDB;

    deserialize(bytes: string): State {
        return State.fromEncoded(bytes);
    }
}
