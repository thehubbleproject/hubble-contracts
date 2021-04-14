import { sleep } from "../../utils";
import { CoreAPI } from "../coreAPI";
import { TransferPackingCommand, TransferPool } from "../features/transfer";
import { BaseService } from "./base";

export class Packer extends BaseService {
    packingCommand: TransferPackingCommand;
    name = "Packer";

    constructor(
        private readonly api: CoreAPI,
        private readonly pool: TransferPool
    ) {
        super();
        this.packingCommand = new TransferPackingCommand(
            api.parameters,
            api.l2Storage,
            this.pool,
            api.contracts.rollup
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
        } catch (err) {
            this.log(`Packing failed ${err}`);
        }
    }
}
