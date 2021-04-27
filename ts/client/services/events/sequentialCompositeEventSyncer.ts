import { EventSyncer } from "./interfaces";

/**
 * Group of EventSyncers which behave like one EventSyncer.
 * initialSync will process the syncers in sequential order.
 * https://en.wikipedia.org/wiki/Composite_pattern
 */
export default class SequentialCompositeEventSyncer implements EventSyncer {
    constructor(private readonly syncers: EventSyncer[]) {}

    public async initialSync(
        startBlock: number,
        endBlock: number
    ): Promise<void> {
        await this.syncers.reduce(async (prev, cur) => {
            await prev;
            await cur.initialSync(startBlock, endBlock);
        }, Promise.resolve());
    }

    listen(): void {
        for (let es of this.syncers) {
            es.listen();
        }
    }

    stopListening(): void {
        for (let es of this.syncers) {
            es.stopListening();
        }
    }
}
