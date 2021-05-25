import { sleep } from "../../utils";
import { CoreAPI } from "../coreAPI";
import { ITransferPool, TransferPackingCommand } from "../features/transfer";
import { BaseService } from "./base";

export class Packer extends BaseService {
    name = "Packer";
    private readonly packingCommand: TransferPackingCommand;
    private readonly pool: ITransferPool;

    constructor(private readonly api: CoreAPI) {
        super();
        this.pool = api.transferPool;
        this.packingCommand = new TransferPackingCommand(
            api.parameters,
            api.l2Storage,
            this.pool,
            api.contracts.rollup,
            api.verifier
        );
    }

    async onRun() {
        if (this.pool.isEmpty()) {
            await sleep(10000);
            return;
        }
        try {
            const tx = await this.packingCommand.packAndSubmit();
            const receipt = await tx.wait(1);
            this.api.syncpoint.bump(receipt.blockNumber);
            console.log(`L1 txn ${tx.hash} mined`);
        } catch (err) {
            this.log(`Packing failed ${err}`);
        }
    }
}
