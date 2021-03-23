import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "ethers";
import { BurnAuction } from "../../../types/ethers-contracts/BurnAuction";

/**
 * Given the amount we are willing bid, the service secure a proposer slot for the client
 */
export class Bidder {
    private constructor(
        public willingnessToBid: BigNumber,
        public burnAuction: BurnAuction,
        public address: string,
        public currentSlot: number
    ) {}

    static async new(willingnessToBid: BigNumber, burnAuction: BurnAuction) {
        const address = await burnAuction.signer.getAddress();
        const currentSlot = await burnAuction.currentSlot();
        return new this(willingnessToBid, burnAuction, address, currentSlot);
    }

    maybeBid = async (blockNumber: number) => {
        console.log("block number", blockNumber);
        const slot = await this.burnAuction.block2slot(blockNumber);
        if (slot > this.currentSlot) {
            this.currentSlot = slot;
            console.info("New slot", slot);
            const currentCoordinator = (await this.burnAuction.auction(slot))
                .coordinator;
            console.info("currentCoordinator", currentCoordinator);
            const biddingSlot = slot + 2;
            const auction = await this.burnAuction.auction(biddingSlot);
            console.info(
                "Auctioning slot",
                "coordinator",
                auction.coordinator,
                "amount",
                ethers.utils.formatEther(auction.amount),
                "ETH"
            );
            console.log(auction.coordinator, this.address);
            if (auction.coordinator == this.address) {
                console.log("We are already the auction winner, no bid");
                return;
            }
            if (auction.amount >= this.willingnessToBid) {
                console.log("Amount > our willingness to bid, no bid!");
                return;
            }
            console.log("Prepare to bid!");
            await this.burnAuction.bid(this.willingnessToBid, {
                value: this.willingnessToBid
            });
        }
    };

    async start() {
        this.burnAuction.provider.on("block", this.maybeBid);
    }

    stop() {
        this.burnAuction.provider.removeListener("block", this.maybeBid);
    }
}
