import { Event, EventFilter } from "@ethersproject/contracts";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { Usage } from "../../interfaces";
import { BatchHandlingContext } from "../contexts";
import { BatchHandlingStrategy } from "../features/interface";

enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private newBatchFilter: EventFilter;
    private batchHandlingContext: BatchHandlingContext;

    constructor(
        private readonly rollup: Rollup,
        private genesisBlock: number,
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
        this.mode = SyncMode.REGULAR_SYNCING;
        this.rollup.on(this.newBatchFilter, this.newBatchListener);
    }

    async initialSync() {
        const chunksize = 100;
        let syncedBlock = this.genesisBlock;
        let latestBlock = await this.rollup.provider.getBlockNumber();
        while (syncedBlock <= latestBlock) {
            const events = await this.rollup.queryFilter(
                this.newBatchFilter,
                syncedBlock,
                syncedBlock + chunksize
            );
            for (const event of events) {
                await this.handleNewBatch(event);
            }
            syncedBlock += Math.min(chunksize, latestBlock - syncedBlock);
            latestBlock = await this.rollup.provider.getBlockNumber();
        }
    }

    async handleNewBatch(event: Event) {
        const usage = event.args?.batchType as Usage;
        this.batchHandlingContext.setStrategy(this.strategies[usage]);
        const batch = await this.batchHandlingContext.parseBatch(event);
        await this.batchHandlingContext.processBatch(batch);
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
