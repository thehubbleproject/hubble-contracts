import { arrayify } from "@ethersproject/bytes";
import { Group, storageManagerFactory } from "../factory";
import * as mcl from "../../ts/mcl";
import { BigNumber } from "@ethersproject/bignumber";
import { Bidder } from "./services/bidder";
import { ethers } from "ethers";
import { SyncerService, SyncMode } from "./services/syncer";
import { Genesis } from "../genesis";
import { DepositPool } from "./features/deposit";
import { buildStrategies } from "./contexts";
import { Packer } from "./services/packer";
import { SimulatorPool } from "./features/transfer";
import { Provider } from "@ethersproject/providers";
import { BurnAuction } from "../../types/ethers-contracts/BurnAuction";

interface ClientConfigs {
    willingnessToBid: BigNumber;
    providerUrl: string;
    genesisPath: string;
}

export enum NodeType {
    Syncer,
    Proposer
}

export class SyncedPoint {
    constructor(public blockNumber: number, public batchID: number) {}
}

export class HubbleNode {
    constructor(
        private nodeType: NodeType,
        private provider: Provider,
        private syncer: SyncerService,
        private packer?: Packer,
        public bidder?: Bidder
    ) {}
    public static async init(nodeType: NodeType) {
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
        const syncedPoint = new SyncedPoint(auxiliary.genesisEth1Block, 0);

        const depositPool = new DepositPool(
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );
        const strategies = buildStrategies(
            contracts,
            storageManager,
            parameters,
            depositPool
        );

        const simPool = new SimulatorPool(group, storageManager.state);
        await simPool.setTokenID();

        const packer = new Packer(
            storageManager,
            parameters,
            contracts,
            simPool,
            syncedPoint
        );
        const bidder = await Bidder.new(
            config.willingnessToBid,
            contracts.burnAuction
        );
        const syncer = new SyncerService(
            contracts.rollup,
            syncedPoint,
            strategies
        );
        return new this(nodeType, provider, syncer, packer, bidder);
    }
    async start() {
        if (this.nodeType === NodeType.Syncer) {
            this.syncer.start();
        } else if (this.nodeType === NodeType.Proposer) {
            const burnAuction = this.burnAuction?.burnAuction as BurnAuction;
            const myAddress = (await burnAuction?.signer.getAddress()) as string;
            const slotLength = Number(await burnAuction?.BLOCKS_PER_SLOT());
            const burnAuctionGenesis = Number(
                await burnAuction?.genesisBlock()
            );
            this.burnAuction?.start();
            this.packer?.start();
            const onSlotBoundary = async () => {
                const currentSlot = Number(await burnAuction?.currentSlot());
                const currentWinner = (await burnAuction?.auction(currentSlot))
                    .coordinator;
                const nextWinner = (await burnAuction?.auction(currentSlot + 1))
                    .coordinator;
                const isProposingThisSlot = currentWinner === myAddress;
                const willProposeNextSlot = nextWinner === myAddress;
                if (isProposingThisSlot && !willProposeNextSlot) {
                    this.packer?.stop();
                    this.syncer.start();
                }
            };
            const onNewSlot = async () => {
                const isProposer = await this.packer?.checkProposer();
                if (isProposer) {
                    this.syncer.stop();
                    this.packer?.start();
                }
            };
            this.provider.on("block", (blockNumber: number) => {
                if (blockNumber < burnAuctionGenesis) return;
                if (this.syncer.getMode() === SyncMode.INITIAL_SYNCING) {
                    console.info("We are still in initial sync, skip");
                    return;
                }
                const blockModSlot =
                    (blockNumber - burnAuctionGenesis) % slotLength;
                if (blockModSlot === slotLength - 1) {
                    onSlotBoundary();
                } else if (blockModSlot === 0) {
                    onNewSlot();
                }
            });
        } else {
            throw new Error("No nodeType");
        }
    }

    async close() {
        console.log("Node start closing");
        this.syncer?.stop();
        this.packer?.stop();
        this.bidder?.stop();
    }
}
