import { Event } from "@ethersproject/contracts";
import { Usage } from "../interfaces";
import { CoreAPI } from "./coreAPI";
import { DepositHandlingStrategy } from "./features/deposit";
import { GenesisHandlingStrategy } from "./features/genesis";
import { Batch, BatchHandlingStrategy } from "./features/interface";
import { TransferHandlingStrategy } from "./features/transfer";

export function buildStrategies(api: CoreAPI) {
    const genesisStrategy = new GenesisHandlingStrategy(api.getGenesisRoot());
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
    const strategies: { [key: string]: BatchHandlingStrategy } = {};
    strategies[Usage.Genesis] = genesisStrategy;
    strategies[Usage.Transfer] = transferStrategy;
    strategies[Usage.Deposit] = depositStrategy;
    return strategies;
}

export class BatchHandlingContext {
    private _strategy?: BatchHandlingStrategy;

    setStrategy(strategy: BatchHandlingStrategy) {
        this._strategy = strategy;
    }
    private get strategy() {
        if (!this._strategy) throw new Error("No strategy set yet");
        return this._strategy;
    }

    async parseBatch(event: Event) {
        return await this.strategy.parseBatch(event);
    }

    async processBatch(batch: Batch) {
        await this.strategy.processBatch(batch);
    }
}
