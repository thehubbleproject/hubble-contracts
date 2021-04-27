import { Event } from "ethers";
import { Usage } from "../../../interfaces";
import { BatchHandlingContext } from "../../contexts";
import { CoreAPI, SyncedPoint } from "../../coreAPI";
import { ContractEventSyncer } from "./contractEventSyncer";

/**
 * Syncs newBatch events from the rollup contract
 */
export class NewBatchEventSyncer extends ContractEventSyncer {
    private readonly batchHandlingContext: BatchHandlingContext;
    private readonly syncpoint: SyncedPoint;

    constructor(api: CoreAPI) {
        super(api.rollup, api.rollup.filters.NewBatch(null, null, null));
        this.eventListener = this.newBatchListener;

        this.syncpoint = api.syncpoint;
        this.batchHandlingContext = new BatchHandlingContext(api);
    }

    public async initialSync(
        startBlock: number,
        endBlock: number
    ): Promise<void> {
        const events = await this.getEvents(startBlock, endBlock);
        console.info(
            `Block ${startBlock} -- ${endBlock}\t${events.length} new batches`
        );
        for (const event of events) {
            await this.handleNewBatch(event);
        }
    }

    private async handleNewBatch(event: Event) {
        const usage = event.args?.batchType as Usage;
        const batchID = Number(event.args?.batchID);
        if (this.syncpoint.batchID >= batchID) {
            console.info(
                "synced before",
                "synced batchID",
                this.syncpoint.batchID,
                "this batchID",
                batchID
            );
            return;
        }
        this.batchHandlingContext.setStrategy(usage);
        const batch = await this.batchHandlingContext.parseBatch(event);
        await this.batchHandlingContext.processBatch(batch);
        this.syncpoint.update(event.blockNumber, batchID);
        console.info(`#${batchID}  [${Usage[usage]}]`, batch.toString());
    }

    newBatchListener = async (
        batchID: null,
        accountRoot: null,
        batchType: null,
        event: Event
    ) => {
        await this.handleNewBatch(event);
    };
}
