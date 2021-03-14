import { Event } from "@ethersproject/contracts";
import { Batch, BatchHandlingStrategy } from "./features/interface";

export class BatchHandlingContext {
    private _strategy?: BatchHandlingStrategy;

    setStrategy(strategy: BatchHandlingStrategy) {
        this._strategy = strategy;
    }
    private get strategy() {
        if (!this._strategy) throw new Error("No strategy set yet");
        return this._strategy;
    }

    async parseBatch(event: Event) {
        return await this.strategy.parseBatch(event);
    }

    async processBatch(batch: Batch) {
        await this.strategy.processBatch(batch);
    }
}
