import { allContracts } from "../../allContractsInterfaces";
import { DeploymentParameters } from "../../interfaces";
import { sleep } from "../../utils";
import { TransferPackingCommand, TransferPool } from "../features/transfer";
import { SyncedPoint } from "../node";
import { StorageManager } from "../storageEngine";

export class Packer {
    private isStopping: boolean;

    constructor(
        private readonly storageManager: StorageManager,
        private readonly parameters: DeploymentParameters,
        private readonly contracts: allContracts,
        private readonly pool: TransferPool,
        private syncpoint: SyncedPoint
    ) {
        this.isStopping = false;
    }
    async checkProposer() {
        try {
            const ourAddress = await this.contracts.burnAuction.signer.getAddress();
            const proposer = await this.contracts.burnAuction.getProposer();
            return proposer === ourAddress;
        } catch (error) {
            return false;
        }
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
            if (!(await this.checkProposer())) {
                await sleep(10);
                console.log("We are not proposer");
                continue;
            }
            const tx = await packingCommand.packAndSubmit();
            await tx.wait(1);
            this.syncpoint.batchID += 1;
        }
    }

    stop() {
        this.isStopping = true;
    }
}
