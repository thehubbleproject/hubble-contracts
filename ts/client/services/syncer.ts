import { EventEmitter } from "events";
import { CoreAPI } from "../coreAPI";
import { EventSyncer } from "./events/interfaces";
import { NewBatchEventSyncer } from "./events/newBatch";
import { SequentialCompositeEventSyncer } from "./events/sequentialCompositeEventSyncer";
import { BatchPubkeyRegisteredEventSyncer } from "./events/batchPubkeyRegistered";
import { SinglePubkeyRegisteredEventSyncer } from "./events/singlePubkeyRegistered";
import { DepositQueuedEventSyncer } from "./events/depositQueued";
import { SyncCompleteEvent } from "../constants";

export enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private readonly events: EventSyncer;
    private readonly eventEmitter: EventEmitter;

    constructor(private readonly api: CoreAPI) {
        this.mode = SyncMode.INITIAL_SYNCING;
        this.eventEmitter = api.eventEmitter;
        this.events = new SequentialCompositeEventSyncer([
            // Note: Ordering here is important for initial syncs.
            // Pubkey syncs need to happen before batch syncs, etc.
            new SinglePubkeyRegisteredEventSyncer(api),
            new BatchPubkeyRegisteredEventSyncer(api),
            new DepositQueuedEventSyncer(api),
            new NewBatchEventSyncer(api)
        ]);
    }

    public getMode(): SyncMode {
        return this.mode;
    }

    public async start(): Promise<void> {
        await this.initialSync();
        this.eventEmitter.emit(SyncCompleteEvent);
        this.mode = SyncMode.REGULAR_SYNCING;

        this.events.listen();
    }

    public async initialSync(): Promise<void> {
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

    public stop() {
        if (this.mode == SyncMode.REGULAR_SYNCING) {
            this.events.stopListening();
        }
    }
}
