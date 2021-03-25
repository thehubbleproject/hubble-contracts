import { BigNumber } from "@ethersproject/bignumber";
import { providers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { BurnAuction } from "../../../types/ethers-contracts/BurnAuction";
import { BurnAuctionWrapper } from "../../burnAuction";

/**
 * Given the amount we are willing bid, the service secure a proposer slot for the client
 */
export class Bidder {
    private constructor(
        public willingnessToBid: BigNumber,
        public burnAuction: BurnAuctionWrapper,
        public provider: providers.Provider,
        public currentSlot: number
    ) {}

    static async new(willingnessToBid: BigNumber, burnAuction: BurnAuction) {
        const wrapper = await BurnAuctionWrapper.fromContract(burnAuction);
        const provider = burnAuction.provider;
        const currentSlot = await burnAuction.currentSlot();
        return new this(willingnessToBid, wrapper, provider, currentSlot);
    }

    maybeBid = async (blockNumber: number) => {
        const slot = this.burnAuction.currentSlot(blockNumber);
        if (slot <= this.currentSlot) return;
        this.currentSlot = slot;
        console.info("New slot", slot);
        const bid = await this.burnAuction.getAuctioningSlotBid(blockNumber);
        console.info(
            "Auctioning slot",
            "coordinator",
            bid.coordinator,
            formatEther(bid.amount),
            "ETH"
        );
        if (bid.coordinator == this.burnAuction.myAddress) {
            console.log("We are already the auction winner, no bid");
            return;
        }
        if (bid.amount >= this.willingnessToBid) {
            console.log("Amount > our willingness to bid, no bid!");
            return;
        }
        console.log("Bid", formatEther(this.willingnessToBid), "ETH");
        await this.burnAuction.bid(this.willingnessToBid);
    };

    async start() {
        this.provider.on("block", this.maybeBid);
    }

    stop() {
        this.provider.removeListener("block", this.maybeBid);
    }
}
