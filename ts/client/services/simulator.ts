import { Group } from "../../factory";
import { StateStorageEngine } from "../storageEngine";

export class Simulator {
    private demandInterval?: NodeJS.Timeout;

    constructor(
        private readonly storage: StateStorageEngine,
        private readonly group: Group
    ) {}

    produceTx() {
        console.log("produce tx");
    }

    start() {
        console.log("simulator started");
        const interval = 1000;
        this.demandInterval = setInterval(this.produceTx, interval);
    }

    stop() {
        if (this.demandInterval) {
            clearInterval(this.demandInterval);
        }
    }
}
