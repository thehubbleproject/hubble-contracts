import { Event } from "ethers";
import { State } from "../../../state";
import { CoreAPI } from "../../coreAPI";
import { DepositPool } from "../../features/deposit";
import { ContractEventSyncer } from "./contractEventSyncer";

/**
 * Syncs DepositQueued events from the despositManager contract
 */
export class DepositQueuedEventSyncer extends ContractEventSyncer {
    private readonly depositPool: DepositPool;

    constructor(api: CoreAPI) {
        super(
            api.contracts.depositManager,
            api.contracts.depositManager.filters.DepositQueued(null, null, null)
        );
        this.eventListener = this.depositQueuedListener;

        this.depositPool = api.depositPool;
    }

    public async initialSync(
        startBlock: number,
        endBlock: number
    ): Promise<void> {
        const events = await this.getEvents(startBlock, endBlock);
        console.info(
            `Block ${startBlock} -- ${endBlock}\t${events.length} new deposits queued`
        );
        for (const event of events) {
            this.handleDepositQueued(event);
        }
    }

    private handleDepositQueued(event: Event) {
        const depositState = State.fromDepositQueuedEvent(event);
        this.depositPool.pushDeposit(depositState.encode());

        console.info(`Deposit queued ${depositState.toString()}`);
    }

    depositQueuedListener = (
        pubkeyID: null,
        tokenID: null,
        l2Amount: null,
        event: Event
    ) => {
        this.handleDepositQueued(event);
    };
}
