import { Event } from "@ethersproject/contracts";
import { Usage } from "../interfaces";
import { CoreAPI } from "./coreAPI";
import { DepositHandlingStrategy } from "./features/deposit";
import { GenesisHandlingStrategy } from "./features/genesis";
import { Batch, BatchHandlingStrategy, OffchainTx } from "./features/interface";
import { TransferHandlingStrategy } from "./features/transfer";

export class BatchHandlingContext {
    private _strategy?: BatchHandlingStrategy;

    private strategies: { [key: string]: BatchHandlingStrategy };
    constructor(api: CoreAPI) {
        const {
            contracts: { rollup },
            l2Storage,
            parameters,
            depositPool
        } = api;
        const genesisStrategy = new GenesisHandlingStrategy(
            rollup,
            api.getGenesisRoot()
        );
        const transferStrategy = new TransferHandlingStrategy(
            rollup,
            l2Storage,
            parameters
        );
        const depositStrategy = new DepositHandlingStrategy(
            rollup,
            l2Storage,
            parameters,
            depositPool
        );
        this.strategies = {
            [Usage.Genesis]: genesisStrategy,
            [Usage.Transfer]: transferStrategy,
            [Usage.Deposit]: depositStrategy
        };
    }

    public setStrategy(usage: Usage) {
        this._strategy = this.strategies[usage];
        if (!this.strategies)
            throw new Error(`No strategy for usage ${Usage[usage]}`);
    }

    private get strategy() {
        if (!this._strategy) throw new Error("No strategy set yet");
        return this._strategy;
    }

    public async parseBatch(event: Event) {
        return await this.strategy.parseBatch(event);
    }

    public async processBatch(batch: Batch): Promise<OffchainTx[]> {
        return this.strategy.processBatch(batch);
    }
}
