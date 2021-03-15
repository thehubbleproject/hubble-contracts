import { Event } from "@ethersproject/contracts";
import { allContracts } from "../allContractsInterfaces";
import { DeploymentParameters, Usage } from "../interfaces";
import { DepositHandlingStrategy, DepositPool } from "./features/deposit";
import { Batch, BatchHandlingStrategy } from "./features/interface";
import { TransferHandlingStrategy } from "./features/transfer";
import { StorageManager } from "./storageEngine";

export function buildStrategies(
    contracts: allContracts,
    storageManager: StorageManager,
    parameters: DeploymentParameters,
    depositPool: DepositPool
) {
    const transferStrategy = new TransferHandlingStrategy(
        contracts.rollup,
        storageManager,
        parameters
    );
    const depositStrategy = new DepositHandlingStrategy(
        contracts.rollup,
        storageManager,
        parameters,
        depositPool
    );
    const strategies: { [key: string]: BatchHandlingStrategy } = {};
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
