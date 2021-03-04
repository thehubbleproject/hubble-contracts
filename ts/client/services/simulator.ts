import { Group } from "../../factory";
import { ProtocolParams, StateMachine } from "../features/interface";
import {
    OffchainTransferFactory,
    TransferStateMachine
} from "../features/transfer";
import { StateStorageEngine, StorageManager } from "../storageEngine";

export class Simulator {
    private demandInterval?: NodeJS.Timeout;
    public factory: OffchainTransferFactory;
    public stateMachine: TransferStateMachine;

    constructor(
        private readonly storageManager: StorageManager,
        private readonly group: Group
    ) {
        const params: ProtocolParams = { maxTxPerCommitment: 10 };
        this.factory = new OffchainTransferFactory(group, storageManager.state);
        this.stateMachine = new TransferStateMachine(params);
    }

    async produceTx() {
        console.log("produce commitment");
        const generator = this.factory.genTx();
        const commitment = await this.stateMachine.pack(
            generator,
            this.storageManager,
            { tokenID: 1, feeReceiverID: 0 }
        );
        console.log(commitment);
    }

    start() {
        console.log("simulator started");
        const interval = 1000;
        const self = this;
        this.demandInterval = setInterval(function() {
            self.produceTx();
        }, interval);
    }

    stop() {
        if (this.demandInterval) {
            clearInterval(this.demandInterval);
        }
    }
}
