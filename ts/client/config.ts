import { BigNumberish } from "ethers";
import { readJSON } from "../file";

export type FeeReceivers = Array<{
    tokenID: BigNumberish;
    stateID: BigNumberish;
}>;

type RPCConfig = {
    address?: string;
    port?: number;
};

type ProposerConfig = {
    enabled: boolean;
    willingnessToBid: number;
    maxPendingTransactions?: number;
    feeReceivers: FeeReceivers;
};

type WatcherConfig = {
    enabled: boolean;
};

export type ClientConfig = {
    genesisPath?: string;
    providerUrl?: string;
    rpc?: RPCConfig;
    proposer?: ProposerConfig;
    watcher?: WatcherConfig;
};

export const configFromPath = async (path?: string): Promise<ClientConfig> => {
    if (!path) {
        console.info("no config path specified, using defaults");
        return {};
    }

    console.info(`loading config from ${path}`);
    const config = await readJSON(path);
    const prettyConfig = JSON.stringify(config, null, 4);
    console.info("config loaded:");
    console.info(prettyConfig);
    return config;
};
