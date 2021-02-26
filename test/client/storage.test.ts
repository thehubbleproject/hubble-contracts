import { assert } from "chai";
import { StateMemoryEngine } from "../../ts/client/storageEngine";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { State } from "../../ts/state";

describe("StateMemoryEngine", function() {
    let engine: StateMemoryEngine;
    let states: State[];
    beforeEach(async function() {
        const params = PRODUCTION_PARAMS;
        engine = new StateMemoryEngine(params.MAX_DEPTH);
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
});
