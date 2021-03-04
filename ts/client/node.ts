import { arrayify } from "@ethersproject/bytes";
import { USDT } from "../decimal";
import { Group } from "../factory";
import { Pubkey } from "../pubkey";
import { State } from "../state";
import { randHex } from "../utils";
import { Simulator } from "./services/simulator";
import {
    PubkeyMemoryEngine,
    StateMemoryEngine,
    StorageManager
} from "./storageEngine";
import * as mcl from "../../ts/mcl";

export class HubbleNode {
    constructor(private simulator: Simulator) {}
    public static async init() {
        await mcl.init();
        const stateStorage = new StateMemoryEngine(32);
        const pubkeyStorage = new PubkeyMemoryEngine(32);
        const storageManager: StorageManager = {
            pubkey: pubkeyStorage,
            state: stateStorage
        };
        const group = Group.new({ n: 32, domain: arrayify(randHex(32)) });
        const tokenID = 1;
        for (const user of group.userIterator()) {
            await stateStorage.update(
                user.stateID,
                State.new(
                    user.pubkeyID,
                    tokenID,
                    USDT.fromHumanValue("100.12").l2Value,
                    0
                )
            );

            await pubkeyStorage.update(user.pubkeyID, new Pubkey(user.pubkey));
        }
        await stateStorage.commit();
        await pubkeyStorage.commit();
        const simulator = new Simulator(storageManager, group);
        simulator.start();
        return new this(simulator);
    }
    async close() {
        console.log("Node start closing");
        this.simulator.stop();
    }
}
