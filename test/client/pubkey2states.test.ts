import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { StateDatabaseEngine } from "../../ts/client/database";
import { PRODUCTION_PARAMS, TESTING_PARAMS } from "../../ts/constants";
import { State } from "../../ts/state";
import del from "del";
import { PubkeyLeaf } from "../../ts/tree/leaves/PubkeyLeaf";
import { init } from "../../ts/mcl";
import { BlsSigner } from "../../ts/blsSigner";
import { Pubkey2StatesDB } from "../../ts/client/database/pubkey2states";
import { Connection } from "../../ts/client/database/connection";

chai.use(chaiAsPromised);

const {
    MAX_DEPTH: maxDepth,
    MAX_DEPOSIT_SUBTREE_DEPTH: maxSubtreeDepth
} = PRODUCTION_PARAMS;

describe("StateDBEngine", () => {
    let engine: StateDatabaseEngine;
    let p0: PubkeyLeaf;
    let p1: PubkeyLeaf;
    let statesP0: State[];
    let statesP1: State[];
    let connection: Connection;

    before(async function() {
        await del("./leveldb/test/*");
        connection = await Connection.create(TESTING_PARAMS.STORAGE_DIRECTORY);
    });

    after(async function() {
        await connection.close();
        await del("./leveldb/test/*");
    });

    beforeEach(async function() {
        engine = new StateDatabaseEngine(maxDepth, connection);
        statesP0 = [];
        statesP1 = [];

        await init();

        p0 = PubkeyLeaf.fromSolG2(
            BlsSigner.new().pubkey,
            0,
            connection.pubkeyDB
        );
        await p0.toDB();

        p1 = PubkeyLeaf.fromSolG2(
            BlsSigner.new().pubkey,
            1,
            connection.pubkeyDB
        );
        await p1.toDB();

        for (let i = 0; i < 4; i++) {
            statesP0.push(State.new(p0.itemID, i, i, i));
        }

        for (let i = 0; i < 2; i++) {
            statesP1.push(State.new(p1.itemID, i, i, i));
        }
    });
    it("update pubkey with states", async function() {
        await engine.updateBatch(0, maxSubtreeDepth, statesP0);
        await engine.updateBatch(1, maxSubtreeDepth, statesP1);

        assert.deepEqual(
            await Pubkey2StatesDB.getStates(
                p0.item.hash(),
                connection.pubkey2statesDB
            ),
            [0, 1, 2, 3]
        );
        assert.deepEqual(
            await Pubkey2StatesDB.getStates(
                p1.item.hash(),
                connection.pubkey2statesDB
            ),
            [4, 5]
        );
    });
});
