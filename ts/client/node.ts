import { Group } from "../factory";
import { Simulator } from "./services/simulator";
import { StateMemoryEngine } from "./storageEngine";

export class HubbleNode {
    constructor(private simulator: Simulator) {}
    public static async init() {
        const stateStorage = new StateMemoryEngine(32);
        const simulator = new Simulator(stateStorage, Group.new({ n: 32 }));
        simulator.start();
        return new this(simulator);
    }
    async close() {
        console.log("Node start closing");
        this.simulator.stop();
    }
}
