import { allContracts } from "../../allContractsInterfaces";
import { DeploymentParameters } from "../../interfaces";
import { TransferPackingCommand, TransferPool } from "../features/transfer";
import { StorageManager } from "../storageEngine";

export class Packer {
    private isStopping: boolean;

    constructor(
        private readonly storageManager: StorageManager,
        private readonly parameters: DeploymentParameters,
        private readonly contracts: allContracts,
        private readonly pool: TransferPool
    ) {
        this.isStopping = false;
    }

    async start() {
        // TODO: what about sync status and client status
        const packingCommand = new TransferPackingCommand(
            this.parameters,
            this.storageManager,
            this.pool,
            this.contracts.rollup
        );
        while (!this.isStopping) {
            const tx = await packingCommand.packAndSubmit();
            await tx.wait(1);
        }
    }

    stop() {
        this.isStopping = true;
    }
}
