import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { StateMemoryEngine } from "../../ts/client/storageEngine";
import { PRODUCTION_PARAMS, ZERO_BYTES32 } from "../../ts/constants";
import { TreeAtLevelIsFull } from "../../ts/exceptions";
import { State } from "../../ts/state";
import { Hasher } from "../../ts/tree";
import { computeRoot } from "../../ts/utils";

chai.use(chaiAsPromised);

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
            const { pathAtDepth, witness } = await engine.findVacantSubtree(
                maxSubtreeDepth
            );
            assert.equal(pathAtDepth, 0);
            assert.lengthOf(witness, 30);
            assert.equal(
                computeRoot(zeroes[witness.length], pathAtDepth, witness),
                engine.root
            );
        });

        it("finds next vacant subtree when first is filled", async function() {
            for (let i = 0; i < 2 ** maxSubtreeDepth; i++) {
                await engine.update(i, states[i]);
            }
            await engine.commit();

            const { pathAtDepth, witness } = await engine.findVacantSubtree(
                maxSubtreeDepth
            );
            assert.equal(pathAtDepth, 1);
            assert.lengthOf(witness, 30);
            assert.equal(
                computeRoot(zeroes[witness.length], pathAtDepth, witness),
                engine.root
            );
        });

        it("finds next vacant subtree when first has cached items", async function() {
            await engine.update(2, states[2]);
            await engine.update(5, states[5]);

            const { pathAtDepth, witness } = await engine.findVacantSubtree(
                maxSubtreeDepth
            );
            assert.equal(pathAtDepth, 2);
            assert.lengthOf(witness, 30);
            assert.equal(
                computeRoot(zeroes[witness.length], pathAtDepth, witness),
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

            await assert.isRejected(
                smallTreeEngine.findVacantSubtree(maxSubtreeDepth),
                TreeAtLevelIsFull
            );
        });
    });

    describe("updateBatch", () => {
        it("updates items at correct itemID", async function() {
            const path = 2;
            const items = states.slice(8, 12);

            await engine.updateBatch(path, maxSubtreeDepth, items);
            await engine.commit();

            for (let i = 8; i < 12; i++) {
                assert.equal(states[i].hash(), (await engine.get(i)).hash());
            }
        });
    });
});
