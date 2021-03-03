import { Event, EventFilter } from "@ethersproject/contracts";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { handleNewBatch } from "../batchHandler";

enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private newBatchFilter: EventFilter;

    constructor(private readonly rollup: Rollup, private genesisBlock: number) {
        this.mode = SyncMode.INITIAL_SYNCING;
        this.newBatchFilter = this.rollup.filters.NewBatch(null, null, null);
    }

    getMode() {
        return this.mode;
    }

    async start() {
        await this.initialSync();
        this.mode = SyncMode.REGULAR_SYNCING;
        this.rollup.on(this.newBatchFilter, this.listener);
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
                await handleNewBatch(event, this.rollup);
            }
            syncedBlock += Math.min(chunksize, latestBlock - syncedBlock);
            latestBlock = await this.rollup.provider.getBlockNumber();
        }
    }

    listener = async (
        batchID: null,
        accountRoot: null,
        batchType: null,
        event: Event
    ) => {
        const batch = await handleNewBatch(event, this.rollup);
        // Run state transition on that batch
    };

    stop() {
        if (this.mode == SyncMode.REGULAR_SYNCING) {
            this.rollup.removeListener(this.newBatchFilter, this.listener);
        }
    }
}
