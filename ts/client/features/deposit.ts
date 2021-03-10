import { BytesLike } from "@ethersproject/bytes";
import { State } from "../../state";
import { Tree } from "../../tree";

interface Subtree {
    root: string;
    states: State[];
}

export class DepositPool {
    private depositLeaves: State[];
    constructor(public readonly paramMaxSubtreeSize: number) {
        this.depositLeaves = [];
    }

    pushDeposit(encodedState: BytesLike) {
        const state = State.fromEncoded(encodedState);
        this.depositLeaves.push(state);
    }

    popDepositSubtree(): Subtree {
        const states = this.depositLeaves.slice();
        const root = Tree.merklize(states.map(s => s.hash())).root;
        this.depositLeaves = [];
        return { states, root };
    }
}
