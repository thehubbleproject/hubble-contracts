import { readFile } from "fs";
import { resolve } from "path";
import { promisify } from "util";

const readFileAsync = promisify(readFile);

export type FeeReceivers = Array<{
    tokenID: number;
    stateID: number;
}>;

type RPCConfig = {
    address?: string;
    port?: number;
};

type ProposerConfig = {
    enabled: boolean;
    willingnessToBid: number;
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

const readConfigFromFile = async (configPath: string): Promise<any> => {
    const configJSONStr = await readFileAsync(configPath, { encoding: "utf8" });
    return JSON.parse(configJSONStr);
};

export const configFromPath = async (path?: string): Promise<ClientConfig> => {
    if (!path) {
        console.info("no config path specified, using defaults");
        return {};
    }

    const configPath = resolve(path);
    console.info(`loading config from ${path}`);
    const config = await readConfigFromFile(configPath);
    const prettyConfig = JSON.stringify(config, null, 4);
    console.info("config loaded:");
    console.info(prettyConfig);
    return config;
};
