import { arrayify } from "@ethersproject/bytes";
import { USDT } from "../decimal";
import { Group } from "../factory";
import { Pubkey } from "../pubkey";
import { State } from "../state";
import { randHex } from "../utils";
import { Simulator } from "./services/simulator";
import {
    PubkeyMemoryEngine,
    StateMemoryEngine,
    StorageManager
} from "./storageEngine";
import * as mcl from "../../ts/mcl";
import { BigNumber } from "@ethersproject/bignumber";
import { BurnAuctionService } from "./services/burnAuction";
import { ethers } from "ethers";
import { SyncerService } from "./services/syncer";
import { Genesis } from "../genesis";

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

        const stateStorage = new StateMemoryEngine(32);
        const pubkeyStorage = new PubkeyMemoryEngine(32);
        const storageManager: StorageManager = {
            pubkey: pubkeyStorage,
            state: stateStorage
        };
        const group = Group.new({ n: 32, domain: arrayify(randHex(32)) });
        const tokenID = 1;
        for (const user of group.userIterator()) {
            await stateStorage.update(
                user.stateID,
                State.new(
                    user.pubkeyID,
                    tokenID,
                    USDT.fromHumanValue("100.12").l2Value,
                    0
                )
            );

            await pubkeyStorage.update(user.pubkeyID, new Pubkey(user.pubkey));
        }
        await stateStorage.commit();
        await pubkeyStorage.commit();

        const simulator = new Simulator(storageManager, group);
        const burnAuctionService = await BurnAuctionService.new(
            config.willingnessToBid,
            contracts.burnAuction
        );
        const syncer = new SyncerService(
            contracts.rollup,
            auxiliary.genesisEth1Block
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
