import { Event, EventFilter } from "@ethersproject/contracts";
import { chunk } from "lodash";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { BlsAccountRegistry } from "../../../types/ethers-contracts/BlsAccountRegistry";
import { Usage } from "../../interfaces";
import { BatchHandlingContext } from "../contexts";
import { CoreAPI } from "../coreAPI";
import { nodeEmitter, SyncCompleteEvent } from "../node";
import { PubkeyStorageEngine } from "../storageEngine";
import { Pubkey } from "../../pubkey";

export enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private newBatchFilter: EventFilter;
    private singlePubkeyRegisteredFilter: EventFilter;
    private batchPubkeyRegisteredFilter: EventFilter;
    private batchHandlingContext: BatchHandlingContext;
    private rollup: Rollup;
    private accountRegistry: BlsAccountRegistry;
    private pubkeyStorage: PubkeyStorageEngine;

    constructor(private readonly api: CoreAPI) {
        this.mode = SyncMode.INITIAL_SYNCING;
        this.rollup = this.api.rollup;
        this.accountRegistry = this.api.contracts.blsAccountRegistry;
        this.newBatchFilter = this.rollup.filters.NewBatch(null, null, null);
        this.singlePubkeyRegisteredFilter = this.accountRegistry.filters.SinglePubkeyRegistered(
            null
        );
        this.batchPubkeyRegisteredFilter = this.accountRegistry.filters.BatchPubkeyRegistered(
            null,
            null
        );
        this.batchHandlingContext = new BatchHandlingContext(api);
        this.pubkeyStorage = this.api.l2Storage.pubkey;
    }

    getMode() {
        return this.mode;
    }

    async start() {
        await this.initialSync();
        nodeEmitter.emit(SyncCompleteEvent);
        this.mode = SyncMode.REGULAR_SYNCING;
        this.rollup.on(this.newBatchFilter, this.newBatchListener);
        this.accountRegistry.on(
            this.singlePubkeyRegisteredFilter,
            this.singlePubkeyRegisteredListener
        );
        this.accountRegistry.on(
            this.batchPubkeyRegisteredFilter,
            this.batchPubkeyRegisteredListener
        );
    }

    async initialPubkeyRegisteredSync(start: number, end: number) {
        await Promise.all([
            this.initialSinglePubkeyRegisteredSync(start, end),
            this.initialBatchPubkeyRegisteredSync(start, end)
        ]);
    }

    async initialSinglePubkeyRegisteredSync(start: number, end: number) {
        const events = await this.accountRegistry.queryFilter(
            this.singlePubkeyRegisteredFilter,
            start,
            end
        );
        console.info(
            `Block ${start} -- ${end}\t${events.length} new single public key registrations`
        );
        await chunk(events, 10).reduce(async (prev, eventsChunk) => {
            await prev;
            await Promise.all(
                eventsChunk.map(e => this.handleSinglePubkeyRegistered(e))
            );
        }, Promise.resolve());
    }

    async initialBatchPubkeyRegisteredSync(_start: number, _end: number) {
        console.error("initialBatchPubkeyRegisteredSync not implemented");
    }

    async initialNewBatchSync(start: number, end: number) {
        const events = await this.rollup.queryFilter(
            this.newBatchFilter,
            start,
            end
        );
        console.info(`Block ${start} -- ${end}\t${events.length} new batches`);
        for (const event of events) {
            await this.handleNewBatch(event);
        }
    }

    async initialSync() {
        const chunksize = 100;
        let start = this.api.syncpoint.blockNumber;
        let latestBlock = await this.api.getBlockNumber();
        let latestBatchID = await this.api.getLatestBatchID();
        while (start <= latestBlock) {
            const end = start + chunksize - 1;

            await this.initialPubkeyRegisteredSync(start, end);
            await this.initialNewBatchSync(start, end);

            start = end + 1;
            latestBlock = await this.api.getBlockNumber();
            latestBatchID = await this.api.getLatestBatchID();
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

    getPubkeyFromTxn(txn: { data: string }): Pubkey {
        // Get public key from registration call data
        const { args } = this.accountRegistry.interface.parseTransaction(txn);
        return new Pubkey(args.pubkey);
    }

    async handleSinglePubkeyRegistered(event: Event) {
        const pubkeyID = event.args?.pubkeyID;

        const txn = await event.getTransaction();
        const pubkey = this.getPubkeyFromTxn(txn);

        await this.pubkeyStorage.update(pubkeyID, pubkey);
        await this.pubkeyStorage.commit();

        console.info(`Pubkey added ID ${pubkeyID} ${pubkey.toString()}`);
    }

    async handleBatchPubkeyRegistered(_event: Event) {
        console.error("handleBatchPubkeyRegistered not implemented");
    }

    newBatchListener = async (
        batchID: null,
        accountRoot: null,
        batchType: null,
        event: Event
    ) => {
        await this.handleNewBatch(event);
    };

    singlePubkeyRegisteredListener = async (pubkeyID: null, event: Event) => {
        await this.handleSinglePubkeyRegistered(event);
    };

    batchPubkeyRegisteredListener = async (
        startID: null,
        endID: null,
        event: Event
    ) => {
        await this.handleBatchPubkeyRegistered(event);
    };

    stop() {
        if (this.mode == SyncMode.REGULAR_SYNCING) {
            this.rollup.removeListener(
                this.newBatchFilter,
                this.newBatchListener
            );
            this.accountRegistry.removeListener(
                this.singlePubkeyRegisteredFilter,
                this.singlePubkeyRegisteredListener
            );
            this.accountRegistry.removeListener(
                this.batchPubkeyRegisteredFilter,
                this.batchPubkeyRegisteredListener
            );
        }
    }
}
