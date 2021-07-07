import { BigNumber } from "@ethersproject/bignumber";
import { assert } from "chai";
import { DepositPool, IDepositPool } from "../../ts/client/features/deposit";
import { TESTING_PARAMS as params } from "../../ts/constants";
import { State } from "../../ts/state";
import { MemoryTree } from "../../ts/tree/memoryTree";

describe("Deposit feature", () => {
    describe("DepositPool", () => {
        let pool: IDepositPool;
        const numStates = 5;
        let states: State[];

        const getMerklizedRoot = async (states: State[]): Promise<string> =>
            (await MemoryTree.merklize(states.map(s => s.hash()))).root;

        beforeEach(function() {
            pool = new DepositPool(params.MAX_DEPOSIT_SUBTREE_DEPTH);

            const tokenID = 1;
            const nonce = 0;
            states = [];
            for (let i = 0; i < numStates; i++) {
                states.push(
                    new State(i, tokenID, BigNumber.from(i * 10), nonce)
                );
            }
        });

        it("toString returns non-empty string", function() {
            assert.isAbove(pool.toString().length, 0);
        });

        it("popDepositSubtree fails when empty", function() {
            assert.throws(pool.popDepositSubtree);
        });

        it("properly queues states and dequeues subtrees", async function() {
            assert.isFalse(pool.isSubtreeReady());

            for (const s of states) {
                await pool.pushDeposit(s.encode());
            }

            assert.isTrue(pool.isSubtreeReady());

            const subtree1 = pool.popDepositSubtree();
            const subtree2 = pool.popDepositSubtree();

            assert.isFalse(pool.isSubtreeReady());

            assert.equal(subtree1.id.toNumber(), 1);
            const subtreeStates1 = [states[0], states[1]];
            assert.deepEqual(subtree1.states, subtreeStates1);
            assert.equal(subtree1.root, await getMerklizedRoot(subtreeStates1));

            assert.equal(subtree2.id.toNumber(), 2);
            const subtreeStates2 = [states[2], states[3]];
            assert.deepEqual(subtree2.states, subtreeStates2);
            assert.equal(subtree2.root, await getMerklizedRoot(subtreeStates2));
        });
    });
});
