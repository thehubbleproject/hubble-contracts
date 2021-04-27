import { Event } from "ethers";
import { chunk } from "lodash";
import { Pubkey } from "../../../pubkey";
import { CoreAPI } from "../../coreAPI";
import { PubkeyStorageEngine } from "../../storageEngine";
import { ContractEventSyncer } from "./contractEventSyncer";

/**
 * Syncs singlePubkeyRegistered events from the blsAccountRegistry contract
 */
export class SinglePubkeyRegisteredEventSyncer extends ContractEventSyncer {
    private readonly pubkeyStorage: PubkeyStorageEngine;

    constructor(api: CoreAPI) {
        super(
            api.contracts.blsAccountRegistry,
            api.contracts.blsAccountRegistry.filters.SinglePubkeyRegistered(
                null
            )
        );
        this.eventListener = this.singlePubkeyRegisteredListener;

        this.pubkeyStorage = api.l2Storage.pubkey;
    }

    public async initialSync(
        startBlock: number,
        endBlock: number
    ): Promise<void> {
        const events = await this.getEvents(startBlock, endBlock);
        console.info(
            `Block ${startBlock} -- ${endBlock}\t${events.length} new single public key registrations`
        );
        await chunk(events, 10).reduce(async (prev, eventsChunk) => {
            await prev;
            await Promise.all(
                eventsChunk.map(e => this.handleSinglePubkeyRegistered(e))
            );
            await this.commitUpdate();
        }, Promise.resolve());
    }

    private async commitUpdate() {
        await this.pubkeyStorage.commit();
    }

    private getPubkeyFromTxn(txn: { data: string }): Pubkey {
        // Get public key from registration call data
        const { args } = this.contract.interface.parseTransaction(txn);
        return new Pubkey(args.pubkey);
    }

    private async handleSinglePubkeyRegistered(event: Event) {
        const pubkeyID = event.args?.pubkeyID;

        const txn = await event.getTransaction();
        const pubkey = this.getPubkeyFromTxn(txn);

        await this.pubkeyStorage.update(pubkeyID, pubkey);

        console.info(`Pubkey added ID ${pubkeyID} ${pubkey.toString()}`);
    }

    singlePubkeyRegisteredListener = async (pubkeyID: null, event: Event) => {
        await this.handleSinglePubkeyRegistered(event);
        await this.commitUpdate();
    };
}
