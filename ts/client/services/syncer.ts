import { Event, EventFilter } from "@ethersproject/contracts";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { Usage } from "../../interfaces";
import { BatchHandlingContext } from "../contexts";
import { BatchHandlingStrategy } from "../features/interface";
import { nodeEmitter, SyncCompleteEvent, SyncedPoint } from "../node";

export enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private newBatchFilter: EventFilter;
    private batchHandlingContext: BatchHandlingContext;

    constructor(
        private readonly rollup: Rollup,
        private syncedPoint: SyncedPoint,
        private strategies: { [key: string]: BatchHandlingStrategy }
    ) {
        this.mode = SyncMode.INITIAL_SYNCING;
        this.newBatchFilter = this.rollup.filters.NewBatch(null, null, null);
        this.batchHandlingContext = new BatchHandlingContext();
    }

    getMode() {
        return this.mode;
    }

    async start() {
        await this.initialSync();
        nodeEmitter.emit(SyncCompleteEvent);
        this.mode = SyncMode.REGULAR_SYNCING;
        this.rollup.on(this.newBatchFilter, this.newBatchListener);
    }

    async initialSync() {
        const chunksize = 100;
        let syncedBlock = this.syncedPoint.blockNumber;
        let latestBlock = await this.rollup.provider.getBlockNumber();
        let latestBatchID = Number(await this.rollup.nextBatchID()) - 1;
        while (syncedBlock <= latestBlock) {
            const start = syncedBlock;
            const end = syncedBlock + chunksize;
            const events = await this.rollup.queryFilter(
                this.newBatchFilter,
                start,
                end
            );
            console.info(
                `Block ${start} -- ${end}\t${events.length} new batches`
            );
            for (const event of events) {
                await this.handleNewBatch(event);
            }
            syncedBlock = this.syncedPoint.blockNumber;
            latestBlock = await this.rollup.provider.getBlockNumber();
            latestBatchID = Number(await this.rollup.nextBatchID()) - 1;
            console.info(
                `block #${this.syncedPoint.blockNumber}/#${latestBlock}  batch ${this.syncedPoint.batchID}/${latestBatchID}`
            );
        }
    }

    async handleNewBatch(event: Event) {
        const usage = event.args?.batchType as Usage;
        const batchID = Number(event.args?.batchID);
        console.info(`#${batchID}\t[${Usage[usage]}]`);
        if (this.syncedPoint.batchID >= batchID) {
            console.info(
                "synced before",
                "synced batchID",
                this.syncedPoint.batchID,
                "this batchID",
                batchID
            );
            return;
        }
        const strategy = this.strategies[usage];
        if (!strategy)
            throw new Error(
                `Fatal: No strategy for usage: ${usage} (${Usage[usage]})`
            );
        this.batchHandlingContext.setStrategy(strategy);
        const batch = await this.batchHandlingContext.parseBatch(event);
        await this.batchHandlingContext.processBatch(batch);
        this.syncedPoint.batchID = batchID;
        this.syncedPoint.blockNumber = event.blockNumber;
    }

    newBatchListener = async (
        batchID: null,
        accountRoot: null,
        batchType: null,
        event: Event
    ) => {
        return await this.handleNewBatch(event);
    };

    stop() {
        if (this.mode == SyncMode.REGULAR_SYNCING) {
            this.rollup.removeListener(
                this.newBatchFilter,
                this.newBatchListener
            );
        }
    }
}
