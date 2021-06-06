import { Event } from "ethers";
import { Usage } from "../../../interfaces";
import { BatchHandlingContext } from "../../contexts";
import { CoreAPI, SyncedPoint } from "../../coreAPI";
import { BatchStorage } from "../../storageEngine/batches/interfaces";
import { TransactionStorage } from "../../storageEngine/transactions/interfaces";
import { ContractEventSyncer } from "./contractEventSyncer";

/**
 * Syncs newBatch events from the rollup contract
 */
export class NewBatchEventSyncer extends ContractEventSyncer {
    private readonly batchHandlingContext: BatchHandlingContext;
    private readonly syncpoint: SyncedPoint;
    private readonly batchStorage: BatchStorage;
    private readonly transactionStorage: TransactionStorage;

    constructor(api: CoreAPI) {
        super(api.rollup, api.rollup.filters.NewBatch(null, null, null));
        this.eventListener = this.newBatchListener;

        this.syncpoint = api.syncpoint;
        this.batchStorage = api.l2Storage.batches;
        this.transactionStorage = api.l2Storage.transactions;
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

        const usage = event.args?.batchType as Usage;
        this.batchHandlingContext.setStrategy(usage);

        const batch = await this.batchHandlingContext.parseBatch(event);
        await this.batchStorage.add(batch, { hash: event.transactionHash });

        const txns = await this.batchHandlingContext.processBatch(batch);
        for (const tx of txns) {
            // TODO Figure out finalization
            // https://github.com/thehubbleproject/hubble-contracts/issues/592
            const finalized = false;
            const l1BlockIncluded = -1;

            await this.transactionStorage.sync(tx, {
                finalized,
                batchID,
                l1TxnHash: event.transactionHash,
                l1BlockIncluded
            });
        }

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
