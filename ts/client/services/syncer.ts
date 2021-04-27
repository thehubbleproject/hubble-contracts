import { CoreAPI } from "../coreAPI";
import { nodeEmitter, SyncCompleteEvent } from "../node";
import { EventSyncer } from "./events/interfaces";
import { NewBatchEventSyncer } from "./events/newBatch";
import { SequentialCompositeEventSyncer } from "./events/sequentialCompositeEventSyncer";
import { BatchPubkeyRegisteredEventSyncer } from "./events/batchPubkeyRegistered";
import { SinglePubkeyRegisteredEventSyncer } from "./events/singlePubkeyRegistered";

export enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private readonly events: EventSyncer;

    constructor(private readonly api: CoreAPI) {
        this.mode = SyncMode.INITIAL_SYNCING;

        this.events = new SequentialCompositeEventSyncer([
            // Note: Ordering here is important for initial syncs.
            // Pubkey syncs need to happen before batch syncs, etc.
            new SinglePubkeyRegisteredEventSyncer(api),
            new BatchPubkeyRegisteredEventSyncer(api),
            new NewBatchEventSyncer(api)
        ]);
    }

    getMode() {
        return this.mode;
    }

    async start() {
        await this.initialSync();
        nodeEmitter.emit(SyncCompleteEvent);
        this.mode = SyncMode.REGULAR_SYNCING;

        this.events.listen();
    }

    async initialSync() {
        const chunksize = 100;
        let start = this.api.syncpoint.blockNumber;
        let latestBlock = await this.api.getBlockNumber();
        let latestBatchID = await this.api.getLatestBatchID();
        while (start <= latestBlock) {
            const end = start + chunksize - 1;

            await this.events.initialSync(start, end);

            start = end + 1;
            latestBlock = await this.api.getBlockNumber();
            latestBatchID = await this.api.getLatestBatchID();
            console.info(
                `block #${this.api.syncpoint.blockNumber}/#${latestBlock}  batch ${this.api.syncpoint.batchID}/${latestBatchID}`
            );
        }
    }

    stop() {
        if (this.mode == SyncMode.REGULAR_SYNCING) {
            this.events.stopListening();
        }
    }
}
