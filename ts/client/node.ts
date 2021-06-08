import { Provider } from "@ethersproject/providers";
import { ethers } from "ethers";
import { EventEmitter } from "events";
import { storageManagerFactory } from "../factory";
import * as mcl from "../../ts/mcl";
import { Bidder } from "./services/bidder";
import { SyncerService } from "./services/syncer";
import { Genesis } from "../genesis";
import { Packer } from "./services/packer";
import { TransferPool } from "./features/transfer";
import { BurnAuctionWrapper } from "../burnAuction";
import { RPC } from "./services/rpc";
import { CoreAPI } from "./coreAPI";
import { NodeType, SyncCompleteEvent } from "./constants";
import { ClientConfig } from "./config";

export class HubbleNode {
    constructor(
        private readonly nodeType: NodeType,
        private readonly provider: Provider,
        private readonly eventEmitter: EventEmitter,
        private readonly syncer: SyncerService,
        private readonly packer?: Packer,
        private readonly bidder?: Bidder,
        private readonly rpc?: RPC
    ) {}

    public static async init(config: ClientConfig) {
        await mcl.init();

        const genesis = Genesis.fromConfig(config.genesisPath);
        const provider = new ethers.providers.JsonRpcProvider(
            config.providerUrl
        );
        const signer = provider.getSigner();

        const { MAX_DEPTH } = genesis.parameters;
        const storageManager = await storageManagerFactory({
            stateTreeDepth: MAX_DEPTH,
            pubkeyTreeDepth: MAX_DEPTH
        });

        // Hardcoded for now, will be configurable in
        // https://github.com/thehubbleproject/hubble-contracts/issues/557
        const feeReceiver = 0;
        const tokenID = 1;
        const pool = new TransferPool(tokenID, feeReceiver);

        const api = CoreAPI.new(
            storageManager,
            genesis,
            provider,
            signer,
            pool
        );

        const syncer = new SyncerService(api);

        let packer;
        let bidder;
        if (config.nodeType === NodeType.Proposer) {
            packer = new Packer(api);

            // TODO Move to config validation
            // https://github.com/thehubbleproject/hubble-contracts/issues/557
            if (!config.proposer?.willingnessToBid) {
                throw new Error("config missing proposer.willingnessToBid");
            }
            bidder = await Bidder.new(
                config.proposer.willingnessToBid,
                api.contracts.burnAuction
            );
        }

        // In the future, we will want to delay starting up the rpc client
        // until after the initial sync is completed (HTTP 503).
        // https://github.com/thehubbleproject/hubble-contracts/issues/558
        const rpc = await RPC.init(api, config.rpcPort);
        return new this(
            config.nodeType,
            provider,
            api.eventEmitter,
            syncer,
            packer,
            bidder,
            rpc
        );
    }
    async start() {
        await this.syncer.start();
        this.eventEmitter.once(SyncCompleteEvent, this.onSyncComplete);
    }
    onSyncComplete = async () => {
        console.info("Initial Sync complete");
        if (this.nodeType !== NodeType.Proposer) {
            console.info("Not a proposer, nothing to do");
            return;
        }
        const burnAuction = this.bidder?.burnAuction as BurnAuctionWrapper;
        this.bidder?.start();
        const onSlotBoundary = async (blockNumber: number) => {
            console.log("On boundary");
            const isProposingThisSlot = await burnAuction.checkAmIProposerNow(
                blockNumber
            );
            const willProposeNextSlot = await burnAuction.checkAmIProposerNext(
                blockNumber
            );
            console.log(
                "Is proposing this slot?",
                isProposingThisSlot,
                "Will propose next slot?",
                willProposeNextSlot
            );
            if (isProposingThisSlot && !willProposeNextSlot) {
                this.packer?.stop();
            }
        };
        const onNewSlot = async (blockNumber: number) => {
            const isProposer = await burnAuction.checkAmIProposerNow(
                blockNumber
            );
            if (!isProposer) {
                this.syncer.start();
                return;
            }
            this.syncer.stop();
            if (this.packer?.isStopped) {
                this.packer?.start();
            }
        };
        this.provider.on("block", async (blockNumber: number) => {
            if (blockNumber < burnAuction.genesisBlock) return;
            const slotLength = burnAuction.blocksPerSlot;
            const blockModSlot = burnAuction.slotProgress(blockNumber);
            console.log(
                `block ${blockNumber}\tSlot progress\t${blockModSlot}/${slotLength}`
            );
            if (blockModSlot === slotLength - 3) {
                onSlotBoundary(blockNumber);
            } else if (blockModSlot === 0) {
                onNewSlot(blockNumber);
            }
        });
    };

    async close() {
        console.log("Node start closing");
        this.syncer?.stop();
        this.packer?.stop();
        this.bidder?.stop();
    }
}
