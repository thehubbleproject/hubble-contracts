import { arrayify } from "@ethersproject/bytes";
import { Group, storageManagerFactory } from "../factory";
import { Simulator } from "./services/simulator";
import * as mcl from "../../ts/mcl";
import { BigNumber } from "@ethersproject/bignumber";
import { BurnAuctionService } from "./services/burnAuction";
import { ethers } from "ethers";
import { SyncerService } from "./services/syncer";
import { Genesis } from "../genesis";
import { TransferHandlingStrategy } from "./features/transfer";
import { DepositHandlingStrategy, DepositPool } from "./features/deposit";
import { Usage } from "../interfaces";
import { BatchHandlingStrategy } from "./features/interface";

interface ClientConfigs {
    willingnessToBid: BigNumber;
    providerUrl: string;
    genesisPath: string;
}

export class HubbleNode {
    constructor(
        private simulator: Simulator,
        public burnAuction?: BurnAuctionService
    ) {}
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
        const { rollup } = contracts;

        const depositPool = new DepositPool(
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        const transferStrategy = new TransferHandlingStrategy(
            rollup,
            storageManager,
            parameters
        );
        const depositStrategy = new DepositHandlingStrategy(
            rollup,
            storageManager,
            parameters,
            depositPool
        );
        const strategies: { [key: string]: BatchHandlingStrategy } = {};
        strategies[Usage.Transfer] = transferStrategy;
        strategies[Usage.Deposit] = depositStrategy;

        const simulator = new Simulator(storageManager, group);
        const burnAuctionService = await BurnAuctionService.new(
            config.willingnessToBid,
            contracts.burnAuction
        );
        const syncer = new SyncerService(
            contracts.rollup,
            auxiliary.genesisEth1Block,
            strategies
        );
        simulator.start();
        burnAuctionService.start();
        return new this(simulator, burnAuctionService);
    }
    async close() {
        console.log("Node start closing");
        this.simulator.stop();
        this.burnAuction?.stop();
    }
}
