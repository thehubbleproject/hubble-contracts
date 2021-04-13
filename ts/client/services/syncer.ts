import { Event, EventFilter } from "@ethersproject/contracts";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { Usage } from "../../interfaces";
import { BatchHandlingContext } from "../contexts";
import { CoreAPI } from "../coreAPI";
import { nodeEmitter, SyncCompleteEvent } from "../node";

export enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private newBatchFilter: EventFilter;
    private batchHandlingContext: BatchHandlingContext;
    private rollup: Rollup;

    constructor(private readonly api: CoreAPI) {
        this.mode = SyncMode.INITIAL_SYNCING;
        this.rollup = this.api.rollup;
        this.newBatchFilter = this.rollup.filters.NewBatch(null, null, null);
        this.batchHandlingContext = new BatchHandlingContext(api);
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
        let start = this.api.syncpoint.blockNumber;
        let latestBlock = await this.api.getBlockNumber();
        let latestBatchID = await this.api.getlatestBatchID();
        while (start <= latestBlock) {
            const end = start + chunksize - 1;
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
            start = end + 1;
            latestBlock = await this.api.getBlockNumber();
            latestBatchID = await this.api.getlatestBatchID();
            console.info(
                `block #${this.api.syncpoint.blockNumber}/#${latestBlock}  batch ${this.api.syncpoint.batchID}/${latestBatchID}`
            );
        }
    }

    async handleNewBatch(event: Event) {
        const usage = event.args?.batchType as Usage;
        const batchID = Number(event.args?.batchID);
        if (this.api.syncpoint.batchID >= batchID) {
            console.info(
                "synced before",
                "synced batchID",
                this.api.syncpoint.batchID,
                "this batchID",
                batchID
            );
            return;
        }
        this.batchHandlingContext.setStrategy(usage);
        const batch = await this.batchHandlingContext.parseBatch(event);
        await this.batchHandlingContext.processBatch(batch);
        this.api.syncpoint.update(event.blockNumber, batchID);
        console.info(`#${batchID}  [${Usage[usage]}]`, batch.toString());
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
