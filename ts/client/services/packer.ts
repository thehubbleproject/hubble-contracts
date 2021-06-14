import { sleep } from "../../utils";
import { CoreAPI } from "../coreAPI";
import { DepositPackingCommand, IDepositPool } from "../features/deposit";
import { ITransferPool, TransferPackingCommand } from "../features/transfer";
import { BaseService } from "./base";
import { BatchPubkeyRegisteredEventSyncer } from "./events/batchPubkeyRegistered";
import { DepositQueuedEventSyncer } from "./events/depositQueued";
import { EventSyncer } from "./events/interfaces";
import { SequentialCompositeEventSyncer } from "./events/sequentialCompositeEventSyncer";
import { SinglePubkeyRegisteredEventSyncer } from "./events/singlePubkeyRegistered";

export class Packer extends BaseService {
    name = "Packer";

    private readonly transferPackingCommand: TransferPackingCommand;

    private readonly depositPool: IDepositPool;
    private readonly depositPackingCommand: DepositPackingCommand;

    private readonly events: EventSyncer;

    constructor(
        private readonly api: CoreAPI,
        private readonly transferPool: ITransferPool
    ) {
        super();

        this.transferPackingCommand = new TransferPackingCommand(
            api.parameters,
            api.l2Storage,
            this.transferPool,
            api.contracts.rollup,
            api.verifier
        );

        this.depositPool = api.depositPool;
        this.depositPackingCommand = new DepositPackingCommand(
            api.parameters,
            api.l2Storage,
            this.depositPool,
            api.contracts.rollup
        );

        /*
         * We still need to watch for certain L1 events while the packer
         * is running. We may want to consider running the syncer alongside
         * the packer with batch syncing disabled to reduce duplication/redundancy here.
         */
        this.events = new SequentialCompositeEventSyncer([
            new SinglePubkeyRegisteredEventSyncer(api),
            new BatchPubkeyRegisteredEventSyncer(api),
            new DepositQueuedEventSyncer(api)
        ]);
    }

    private shouldWait(): boolean {
        return (
            this.transferPool.isEmpty() && !this.depositPool.isSubtreeReady()
        );
    }

    private async maybePackDeposits(): Promise<void> {
        while (this.depositPool.isSubtreeReady()) {
            const tx = await this.depositPackingCommand.packAndSubmit();
            const receipt = await tx.wait(1);
            this.api.syncpoint.bump(receipt.blockNumber);
            this.log(`L1 deposit txn ${tx.hash} mined`);
        }
    }

    private async maybePackTransfers(): Promise<void> {
        while (!this.transferPool.isEmpty()) {
            const tx = await this.transferPackingCommand.packAndSubmit();
            const receipt = await tx.wait(1);
            this.api.syncpoint.bump(receipt.blockNumber);
            this.log(`L1 transfer txn ${tx.hash} mined`);
        }
    }

    protected async onStart(): Promise<void> {
        this.events.listen();
    }

    protected async onFinished(): Promise<void> {
        this.events.stopListening();
    }

    public async runOnce(): Promise<void> {
        await this.maybePackDeposits();
        await this.maybePackTransfers();
    }

    public async onRun() {
        if (this.shouldWait()) {
            await sleep(10000);
            return;
        }

        await this.runOnce();
    }
}
