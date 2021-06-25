import { BigNumber } from "@ethersproject/bignumber";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";

export interface Bid {
    coordinator: string;
    amount: BigNumber;
    initialized: boolean;
}

export class BurnAuctionWrapper {
    private constructor(
        public readonly burnAuction: BurnAuction,
        public readonly initialBlocks: number,
        public readonly blocksPerSlot: number,
        public readonly genesisBlock: number,
        public readonly myAddress: string
    ) {}
    static async fromContract(burnAuction: BurnAuction) {
        const [
            initialBlocks,
            blocksPerSlot,
            genesisBlock,
            myAddress
        ] = await Promise.all([
            burnAuction.DELTA_BLOCKS_INITIAL_SLOT(),
            burnAuction.BLOCKS_PER_SLOT(),
            burnAuction.genesisBlock(),
            burnAuction.signer.getAddress()
        ]);

        return new this(
            burnAuction,
            initialBlocks,
            blocksPerSlot,
            Number(genesisBlock),
            myAddress
        );
    }

    async bid(amount: BigNumber) {
        return this.burnAuction.bid(amount, { value: amount });
    }

    currentSlot(blockNumber: number) {
        if (blockNumber < this.genesisBlock) return 0;
        return Math.floor(
            (blockNumber - this.genesisBlock) / this.blocksPerSlot
        );
    }
    slotProgress(blockNumber: number) {
        if (blockNumber < this.genesisBlock) return 0;
        return (blockNumber - this.genesisBlock) % this.blocksPerSlot;
    }

    async getCurrentSlot(blockNumber?: number) {
        const _blockNumber =
            blockNumber ?? (await this.burnAuction.provider.getBlockNumber());
        return this.currentSlot(_blockNumber);
    }

    async getBid(slot: number): Promise<Bid> {
        const bid = await this.burnAuction.auction(slot);
        return bid;
    }

    async getNSlotBidFromNow(n = 0, blockNumber?: number) {
        const slot = await this.getCurrentSlot(blockNumber);
        return await this.getBid(slot + n);
    }

    async getCurrentSlotBid(blockNumber?: number) {
        return await this.getNSlotBidFromNow(0, blockNumber);
    }

    async getNextSlotBid(blockNumber?: number) {
        return await this.getNSlotBidFromNow(1, blockNumber);
    }

    async getAuctioningSlotBid(blockNumber?: number) {
        return await this.getNSlotBidFromNow(2, blockNumber);
    }

    async checkNSlotProposer(n = 0, blockNumber?: number) {
        const bid = await this.getNSlotBidFromNow(n, blockNumber);
        return bid.coordinator === this.myAddress;
    }

    async checkAmIProposerNow(blockNumber?: number) {
        return this.checkNSlotProposer(0, blockNumber);
    }
    async checkAmIProposerNext(blockNumber?: number) {
        return this.checkNSlotProposer(1, blockNumber);
    }
}
