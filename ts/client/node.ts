import { Provider } from "@ethersproject/providers";
import { BigNumber, ethers } from "ethers";
import { EventEmitter } from "events";
import { FastifyInstance } from "fastify";
import { storageManagerFactory } from "../factory";
import * as mcl from "../../ts/mcl";
import { Bidder } from "./services/bidder";
import { SyncerService, SyncMode } from "./services/syncer";
import { Packer } from "./services/packer";
import { TransferPool } from "./features/transfer";
import { BurnAuctionWrapper } from "../burnAuction";
import { RPC } from "./services/rpc";
import { CoreAPI } from "./coreAPI";
import { SyncCompleteEvent } from "./constants";
import { ClientConfig } from "./config";
import { Genesis } from "../genesis";
import { EmptyConfigPropError, MissingConfigPropError } from "../exceptions";
import { close as closeDB } from "./database/connection";

export type NodeModes = {
    isProposer: boolean;
    isWatcher: boolean;
};

export class HubbleNode {
    constructor(
        private readonly modes: NodeModes,
        private readonly provider: Provider,
        private readonly eventEmitter: EventEmitter,
        private readonly syncer: SyncerService,
        private readonly packer?: Packer,
        private readonly bidder?: Bidder,
        private readonly rpc?: RPC
    ) {}

    public static async init(config: ClientConfig, fast: FastifyInstance) {
        await mcl.init();
        const genesis = await Genesis.fromConfig(config.genesisPath);

        const provider = new ethers.providers.JsonRpcProvider(
            config.providerUrl,
            genesis.auxiliary.chainid
        );
        provider.on("error", err => {
            console.error(err);
        });

        const { MAX_DEPTH } = genesis.parameters;
        const storageManager = await storageManagerFactory({
            stateTreeDepth: MAX_DEPTH,
            pubkeyTreeDepth: MAX_DEPTH
        });

        const signer = provider.getSigner();
        const api = CoreAPI.new(storageManager, genesis, provider, signer);

        const syncer = new SyncerService(api);

        let transferPool;
        let packer;
        let bidder;

        const modes = this.getNodeModes(config);
        if (modes.isProposer) {
            const { feeReceivers, willingnessToBid, maxPendingTransactions } =
                config.proposer || {};
            if (!feeReceivers) {
                throw new MissingConfigPropError("proposer.feeRecievers");
            }
            if (!feeReceivers.length) {
                throw new EmptyConfigPropError("proposer.feeRecievers");
            }
            if (!willingnessToBid) {
                throw new MissingConfigPropError("proposer.willingnessToBid");
            }

            transferPool = new TransferPool(
                storageManager.state,
                feeReceivers,
                maxPendingTransactions
            );

            packer = new Packer(api, transferPool);
            bidder = await Bidder.new(
                BigNumber.from(willingnessToBid),
                api.contracts.burnAuction
            );
        }
        if (modes.isWatcher) {
            throw new Error("watcher is currently not supported");
        }

        fast.addHook("onRequest", async (_request, reply) => {
            if (syncer.getMode() === SyncMode.INITIAL_SYNCING) {
                return reply.status(503).send({
                    message: "Initial sync incomplete",
                    error: "RPC unavailable",
                    statusCode: 503
                });
            }
        });

        const rpc = new RPC(api, fast, transferPool);
        return new this(
            modes,
            provider,
            api.eventEmitter,
            syncer,
            packer,
            bidder,
            rpc
        );
    }

    private static getNodeModes({
        proposer,
        watcher
    }: ClientConfig): NodeModes {
        return {
            isProposer: proposer ? proposer.enabled : false,
            isWatcher: watcher ? watcher.enabled : false
        };
    }

    public async start() {
        this.eventEmitter.once(SyncCompleteEvent, this.onSyncComplete);
        await this.syncer.start();
    }

    public async close() {
        console.log("Node start closing");
        this.syncer.stop();
        this.packer?.stop();
        this.bidder?.stop();
        console.log("closing leveldb connection");
        await closeDB();
    }

    onSyncComplete = async () => {
        console.info("Initial Sync complete");
        if (!this.modes.isProposer) {
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
}
