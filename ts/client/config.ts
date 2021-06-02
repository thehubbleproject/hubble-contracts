import { BigNumber } from "ethers";
import { NodeType } from "./constants";

interface ProposerConfig {
    willingnessToBid?: BigNumber;
}

export interface ClientConfig {
    nodeType: NodeType;
    providerUrl: string;
    genesisPath: string;
    rpcPort: number;
    proposer?: ProposerConfig;
}
