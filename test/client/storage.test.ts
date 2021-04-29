import { assert } from "chai";
import { StateMemoryEngine } from "../../ts/client/storageEngine";
import { PRODUCTION_PARAMS, ZERO_BYTES32 } from "../../ts/constants";
import { State } from "../../ts/state";
import { Hasher } from "../../ts/tree";
import { computeRoot } from "../../ts/utils";

const {
    MAX_DEPTH: maxDepth,
    MAX_DEPOSIT_SUBTREE_DEPTH: maxSubtreeDepth
} = PRODUCTION_PARAMS;

describe("StateMemoryEngine", () => {
    let engine: StateMemoryEngine;
    let states: State[];
    beforeEach(async function() {
        engine = new StateMemoryEngine(maxDepth);
        states = [];
        for (let i = 0; i < 20; i++) {
            states.push(State.new(i, i, i, i));
        }
    });
    it("creates gets updates commits and reverts", async function() {
        const root0 = engine.root;
        for (let i = 0; i < 10; i++) {
            engine.create(i, states[i]);
        }
        for (let i = 0; i < 10; i++) {
            assert.equal(await engine.get(i), states[i]);
            assert.equal((await engine.getWithWitness(i)).item, states[i]);
        }
        assert.equal(engine.root, root0, "Root before commit");
        await engine.commit();
        const root1 = engine.root;
        assert.notEqual(root1, root0, "Root after commit");
        const checkpoint = engine.getCheckpoint();
        for (let i = 10; i < 20; i++) {
            engine.create(i, states[i]);
        }
        for (let i = 0; i < 10; i++) {
            engine.update(i, states[i + 10]);
        }
        engine.revert(checkpoint);
        assert.equal(engine.root, root1, "revert to previous root");
    });

    describe("findVacantSubtree", () => {
        const hasher = Hasher.new("bytes", ZERO_BYTES32);
        const zeroes = hasher.zeros(maxDepth);

        it("finds first vacant subtree when empty", async function() {
            const { path, witness } = await engine.findVacantSubtree(
                maxSubtreeDepth
            );
            assert.equal(path, 0);
            assert.lengthOf(witness, 30);
            assert.equal(
                computeRoot(zeroes[witness.length], path, witness),
                engine.root
            );
        });

        it("finds next vacant subtree when first is filled", async function() {
            for (let i = 0; i < 2 ** maxSubtreeDepth; i++) {
                await engine.update(i, states[i]);
            }
            await engine.commit();

            const { path, witness } = await engine.findVacantSubtree(
                maxSubtreeDepth
            );
            assert.equal(path, 1);
            assert.lengthOf(witness, 30);
            assert.equal(
                computeRoot(zeroes[witness.length], path, witness),
                engine.root
            );
        });

        it("finds next vacant subtree when first has cached items", async function() {
            await engine.update(2, states[2]);
            await engine.update(5, states[5]);

            const { path, witness } = await engine.findVacantSubtree(
                maxSubtreeDepth
            );
            assert.equal(path, 2);
            assert.lengthOf(witness, 30);
            assert.equal(
                computeRoot(zeroes[witness.length], path, witness),
                engine.root
            );
        });

        it("fails when tree is full", async function() {
            const depth = 4;
            const smallTreeEngine = new StateMemoryEngine(depth);
            for (let i = 0; i < 2 ** depth; i++) {
                await smallTreeEngine.update(i, State.new(i, i, i, i));
            }
            await smallTreeEngine.commit();

            let errMsg = "";
            try {
                await smallTreeEngine.findVacantSubtree(maxSubtreeDepth);
            } catch (err) {
                errMsg = err.message;
            }
            assert.equal(
                errMsg,
                `Tree at level ${depth -
                    maxSubtreeDepth} is full, no room for subtree insert`
            );
        });
    });

    describe("updateBatch", () => {
        it("updates items at correct itemID", async function() {
            const subtreeID = 2;
            const items = states.slice(8, 12);

            await engine.updateBatch(subtreeID, maxSubtreeDepth, items);
            await engine.commit();

            for (let i = 8; i < 12; i++) {
                assert.equal(states[i].hash(), (await engine.get(i)).hash());
            }
        });
    });
});
