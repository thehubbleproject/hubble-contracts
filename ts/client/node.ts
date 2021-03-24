import { arrayify } from "@ethersproject/bytes";
import { Group, storageManagerFactory } from "../factory";
import { Simulator } from "./services/simulator";
import * as mcl from "../../ts/mcl";
import { BigNumber } from "@ethersproject/bignumber";
import { Bidder } from "./services/bidder";
import { ethers } from "ethers";
import { SyncerService } from "./services/syncer";
import { Genesis } from "../genesis";
import { DepositPool } from "./features/deposit";
import { buildStrategies } from "./contexts";

interface ClientConfigs {
    willingnessToBid: BigNumber;
    providerUrl: string;
    genesisPath: string;
}

export class HubbleNode {
    constructor(private simulator: Simulator, public bidder?: Bidder) {}
    public static async init() {
        await mcl.init();
        const config: ClientConfigs = {
            willingnessToBid: BigNumber.from(1),
            providerUrl: "http://localhost:8545",
            genesisPath: "./genesis.json"
        };

        const genesis = Genesis.fromConfig(config.genesisPath);
        const provider = new ethers.providers.JsonRpcProvider(
            config.providerUrl
        );
        const signer = provider.getSigner();
        const contracts = genesis.getContracts(signer);
        const { parameters, auxiliary } = genesis;

        const group = Group.new({ n: 32, domain: arrayify(auxiliary.domain) });
        const storageManager = await storageManagerFactory(group, {
            stateTreeDepth: parameters.MAX_DEPTH
        });

        const depositPool = new DepositPool(
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );
        const strategies = buildStrategies(
            contracts,
            storageManager,
            parameters,
            depositPool
        );

        const simulator = new Simulator(storageManager, group);
        const bidder = await Bidder.new(
            config.willingnessToBid,
            contracts.burnAuction
        );
        const syncer = new SyncerService(
            contracts.rollup,
            auxiliary.genesisEth1Block,
            strategies
        );
        simulator.start();
        bidder.start();
        return new this(simulator, bidder);
    }
    async close() {
        console.log("Node start closing");
        this.simulator.stop();
        this.bidder?.stop();
    }
}
