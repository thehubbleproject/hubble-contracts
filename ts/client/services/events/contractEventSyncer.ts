import { EventFilter } from "@ethersproject/contracts";
import { Listener } from "@ethersproject/abstract-provider";
import { Contract, Event } from "ethers";
import { EventSyncer } from "./interfaces";

/**
 * Abstract class for common EventSyncers that watch a contract for events.
 * Be sure to:
 *  - Override initialSync. See getEvents for a convenient way to get events.
 *  - Set an eventListener after construction. This is done
 * to allow proper 'this' scope binding for callbacks.
 */
export abstract class ContractEventSyncer implements EventSyncer {
    protected eventListener?: Listener;

    /**
     * @param contract The contract to listen to.
     * @param filter The event filter.
     */
    constructor(
        protected readonly contract: Contract,
        protected readonly filter: EventFilter
    ) {}

    public async initialSync(
        _startBlock: number,
        _endBlock: number
    ): Promise<void> {
        throw new Error("EventSyncerBase: Method initialSync not implemented.");
    }

    public listen() {
        if (!this.eventListener) {
            throw new Error("EventSyncerBase: eventListener not set.");
        }

        this.contract.on(this.filter, this.eventListener);
    }

    public stopListening() {
        if (!this.eventListener) {
            throw new Error("EventSyncerBase: eventListener not set.");
        }

        this.contract.removeListener(this.filter, this.eventListener);
    }

    protected async getEvents(
        startBlock: number,
        endBlock: number
    ): Promise<Event[]> {
        return this.contract.queryFilter(this.filter, startBlock, endBlock);
    }
}
