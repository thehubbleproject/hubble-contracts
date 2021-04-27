import { Event, EventFilter } from "@ethersproject/contracts";
import { chunk } from "lodash";
import { BlsAccountRegistry } from "../../../types/ethers-contracts/BlsAccountRegistry";
import { CoreAPI } from "../coreAPI";
import { nodeEmitter, SyncCompleteEvent } from "../node";
import { PubkeyStorageEngine } from "../storageEngine";
import { Pubkey } from "../../pubkey";
import { EventSyncer } from "./events/interfaces";
import { NewBatchEventSyncer } from "./events/newBatch";
import SequentialCompositeEventSyncer from "./events/sequentialCompositeEventSyncer";

export enum SyncMode {
    INITIAL_SYNCING,
    REGULAR_SYNCING
}

export class SyncerService {
    private mode: SyncMode;
    private singlePubkeyRegisteredFilter: EventFilter;
    private batchPubkeyRegisteredFilter: EventFilter;
    private accountRegistry: BlsAccountRegistry;
    private pubkeyStorage: PubkeyStorageEngine;
    private readonly events: EventSyncer;

    constructor(private readonly api: CoreAPI) {
        this.mode = SyncMode.INITIAL_SYNCING;
        this.accountRegistry = this.api.contracts.blsAccountRegistry;
        this.singlePubkeyRegisteredFilter = this.accountRegistry.filters.SinglePubkeyRegistered(
            null
        );
        this.batchPubkeyRegisteredFilter = this.accountRegistry.filters.BatchPubkeyRegistered(
            null,
            null
        );
        this.pubkeyStorage = this.api.l2Storage.pubkey;

        this.events = new SequentialCompositeEventSyncer([
            // Note: Ordering here is important for initial syncs.
            // Pubkey syncs need to happen before batch syncs, etc.
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

    async initialSync() {
        const chunksize = 100;
        let start = this.api.syncpoint.blockNumber;
        let latestBlock = await this.api.getBlockNumber();
        let latestBatchID = await this.api.getLatestBatchID();
        while (start <= latestBlock) {
            const end = start + chunksize - 1;

            await this.initialPubkeyRegisteredSync(start, end);
            await this.events.initialSync(start, end);

            start = end + 1;
            latestBlock = await this.api.getBlockNumber();
            latestBatchID = await this.api.getLatestBatchID();
            console.info(
                `block #${this.api.syncpoint.blockNumber}/#${latestBlock}  batch ${this.api.syncpoint.batchID}/${latestBatchID}`
            );
        }
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
            this.events.stopListening();
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
