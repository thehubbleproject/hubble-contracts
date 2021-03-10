import { BytesLike } from "@ethersproject/bytes";
import { State } from "../../state";
import { Tree } from "../../tree";

interface Subtree {
    root: string;
    states: State[];
}

export class DepositPool {
    private depositLeaves: State[];
    private subtreeQueue: Subtree[];
    constructor(public readonly paramMaxSubtreeSize: number) {
        this.depositLeaves = [];
        this.subtreeQueue = [];
    }

    pushDeposit(encodedState: BytesLike) {
        const state = State.fromEncoded(encodedState);
        this.depositLeaves.push(state);
        if (this.depositLeaves.length >= this.paramMaxSubtreeSize) {
            this.pushSubtree();
        }
    }
    private pushSubtree() {
        const states = this.depositLeaves.slice();
        const root = Tree.merklize(states.map(s => s.hash())).root;
        this.depositLeaves = [];
        this.subtreeQueue.push({ states, root });
    }

    popDepositSubtree(): Subtree {
        const subtree = this.subtreeQueue.shift();
        if (!subtree) throw new Error("no subtre available");
        return subtree;
    }
}
