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
        const genesisStrategy = new GenesisHandlingStrategy(
            api.getGenesisRoot()
        );
        const transferStrategy = new TransferHandlingStrategy(
            api.contracts.rollup,
            api.l2Storage,
            api.parameters
        );
        const depositStrategy = new DepositHandlingStrategy(
            api.contracts.rollup,
            api.l2Storage,
            api.parameters,
            api.depositPool
        );
        this.strategies = {};
        this.strategies[Usage.Genesis] = genesisStrategy;
        this.strategies[Usage.Transfer] = transferStrategy;
        this.strategies[Usage.Deposit] = depositStrategy;
    }

    setStrategy(usage: Usage) {
        this._strategy = this.strategies[usage];
        if (!this.strategies)
            throw new Error(`No strategy for usage ${Usage[usage]}`);
    }
    private get strategy() {
        if (!this._strategy) throw new Error("No strategy set yet");
        return this._strategy;
    }

    async parseBatch(event: Event) {
        return await this.strategy.parseBatch(event);
    }

    async processBatch(batch: Batch): Promise<OffchainTx[]> {
        return this.strategy.processBatch(batch);
    }
}
