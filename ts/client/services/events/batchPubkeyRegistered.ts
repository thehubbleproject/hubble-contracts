import { Event } from "ethers";
import { CoreAPI } from "../../coreAPI";
import { PubkeyStorageEngine } from "../../storageEngine";
import { ContractEventSyncer } from "./contractEventSyncer";

/**
 * Syncs batchPubkeyRegistered events from the blsAccountRegistry contract
 */
export class BatchPubkeyRegisteredEventSyncer extends ContractEventSyncer {
    private readonly pubkeyStorage: PubkeyStorageEngine;

    constructor(api: CoreAPI) {
        super(
            api.contracts.blsAccountRegistry,
            api.contracts.blsAccountRegistry.filters.BatchPubkeyRegistered(
                null,
                null
            )
        );
        this.eventListener = this.batchPubkeyRegisteredListener;

        this.pubkeyStorage = api.l2Storage.pubkey;
    }

    public async initialSync(
        _startBlock: number,
        _endBlock: number
    ): Promise<void> {
        console.error(
            "BatchPubkeyRegisteredEventSyncer: initialSync not implemented."
        );
    }

    private async handleBatchPubkeyRegistered(_event: Event) {
        console.error(
            "BatchPubkeyRegisteredEventSyncer: handleBatchPubkeyRegistered not implemented."
        );
    }

    batchPubkeyRegisteredListener = async (
        startID: null,
        endID: null,
        event: Event
    ) => {
        await this.handleBatchPubkeyRegistered(event);
    };
}
