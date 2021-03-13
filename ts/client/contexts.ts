import { Event } from "@ethersproject/contracts";
import { Batch, BatchHandlingStrategy } from "./features/interface";

export class BatchHandlingContext {
    private strategy?: BatchHandlingStrategy;

    setStrategy(strategy: BatchHandlingStrategy) {
        this.strategy = strategy;
    }

    async parseBatch(event: Event) {
        return await this.strategy?.parseBatch(event);
    }

    async processBatch(batch: Batch) {
        await this.strategy?.processBatch(batch);
    }
}
