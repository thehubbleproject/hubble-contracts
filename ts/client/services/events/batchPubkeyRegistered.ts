import { Event } from "ethers";
import { chunk } from "lodash";
import { PRODUCTION_PARAMS } from "../../../constants";
import { solG2 } from "../../../mcl";
import { Pubkey } from "../../../pubkey";
import { CoreAPI } from "../../coreAPI";
import { PubkeyStorageEngine } from "../../storageEngine";
import { ContractEventSyncer } from "./contractEventSyncer";

/**
 * Syncs BatchPubkeyRegistered events from the blsAccountRegistry contract
 */
export class BatchPubkeyRegisteredEventSyncer extends ContractEventSyncer {
    private readonly pubkeyStorage: PubkeyStorageEngine;

    constructor(api: CoreAPI) {
        super(
            api.contracts.blsAccountRegistry,
            api.contracts.blsAccountRegistry.filters.BatchPubkeyRegistered()
        );
        this.eventListener = this.batchPubkeyRegisteredListener;

        this.pubkeyStorage = api.l2Storage.pubkey;
    }

    public async initialSync(
        startBlock: number,
        endBlock: number
    ): Promise<void> {
        const events = await this.getEvents(startBlock, endBlock);
        console.info(
            `Block ${startBlock} -- ${endBlock}\t${events.length} new batch public key registrations`
        );

        await chunk(events, 10).reduce(async (prev, eventsChunk) => {
            await prev;
            await Promise.all(
                eventsChunk.map(e => this.handleBatchPubkeyRegistered(e))
            );
            await this.commitUpdate();
        }, Promise.resolve());
    }

    private async commitUpdate() {
        // unused with db engine
        await this.pubkeyStorage.commit();
    }

    private getPubkeysFromTxn(txn: { data: string }): Pubkey[] {
        // Get public key from registration call data
        const { args } = this.contract.interface.parseTransaction(txn);
        return args.pubkeys.map((pubkey: solG2) => new Pubkey(pubkey));
    }

    private async handleBatchPubkeyRegistered(event: Event) {
        let startID = event.args?.startID;

        const txn = await event.getTransaction();
        const keysBatch = this.getPubkeysFromTxn(txn);

        const baseIndex = 2 ** (PRODUCTION_PARAMS.MAX_DEPTH - 1);
        let nextIndex = baseIndex + Number(startID);

        for (const key of keysBatch) {
            await this.pubkeyStorage.update(nextIndex, key);
            console.info(`Pubkey added ID ${nextIndex} ${key.toString()}`);
            nextIndex++;
        }
    }

    batchPubkeyRegisteredListener = async (
        startID: null,
        endID: null,
        event: Event
    ) => {
        await this.handleBatchPubkeyRegistered(event);
        // unused with db engine
        await this.commitUpdate();
    };
}
