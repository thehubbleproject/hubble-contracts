import { assert } from "chai";
import { DepositPool, IDepositPool } from "../../ts/client/features/deposit";
import { TESTING_PARAMS as params } from "../../ts/constants";
import { State } from "../../ts/state";
import { MemoryTree } from "../../ts/tree/memoryTree";

const encode = (states: State[]): string[] => states.map(s => s.encode());

describe("Deposit feature", () => {
    describe("DepositPool", () => {
        let pool: IDepositPool;
        const numStates = 5;
        let states: State[];

        const getMerklizedRoot = (states: State[]): string =>
            MemoryTree.merklize(states.map(s => s.hash())).root;

        beforeEach(function() {
            pool = new DepositPool(params.MAX_DEPOSIT_SUBTREE_DEPTH);

            const tokenID = 1;
            const nonce = 0;
            states = [];
            for (let i = 0; i < numStates; i++) {
                states.push(State.new(i, tokenID, i * 10, nonce));
            }
        });

        it("toString returns non-empty string", function() {
            assert.isAbove(pool.toString().length, 0);
        });

        it("popDepositSubtree fails when empty", function() {
            assert.throws(pool.popDepositSubtree);
        });

        it("properly queues states and dequeues subtrees", function() {
            assert.isFalse(pool.isSubtreeReady());

            for (const s of states) {
                pool.pushDeposit(s.encode());
            }

            assert.isTrue(pool.isSubtreeReady());

            const subtree1 = pool.popDepositSubtree();
            const subtree2 = pool.popDepositSubtree();

            assert.isFalse(pool.isSubtreeReady());

            assert.equal(subtree1.id.toNumber(), 1);
            const subtreeStates1 = [states[0], states[1]];
            assert.deepEqual(encode(subtree1.states), encode(subtreeStates1));
            assert.equal(subtree1.root, getMerklizedRoot(subtreeStates1));

            assert.equal(subtree2.id.toNumber(), 2);
            const subtreeStates2 = [states[2], states[3]];
            assert.deepEqual(encode(subtree2.states), encode(subtreeStates2));
            assert.equal(subtree2.root, getMerklizedRoot(subtreeStates2));
        });
    });
});
