import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { assert } from "chai";
import { ethers } from "hardhat";
import { BurnAuctionWrapper } from "../../ts/burnAuction";
import { Bidder } from "../../ts/client/services/bidder";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { mineBlocks } from "../../ts/utils";
import {
    BurnAuction,
    BurnAuction__factory
} from "../../types/ethers-contracts";

describe("Bidder", function() {
    let deployer: Signer;
    let serviceSigner: Signer;
    let competitor: Signer;
    let contract: BurnAuction;
    let burnAuction: BurnAuctionWrapper;
    let bidder: Bidder;
    const willingnessToBid = BigNumber.from("1");

    beforeEach(async function() {
        [deployer, serviceSigner, competitor] = await ethers.getSigners();
        contract = await new BurnAuction__factory(deployer).deploy(
            PRODUCTION_PARAMS.DONATION_ADDRESS,
            PRODUCTION_PARAMS.DONATION_NUMERATOR
        );
        burnAuction = await BurnAuctionWrapper.fromContract(contract);

        bidder = await Bidder.new(
            willingnessToBid,
            contract.connect(serviceSigner)
        );
        const nblocks = burnAuction.initialBlocks + burnAuction.blocksPerSlot;
        await mineBlocks(ethers.provider, nblocks);
    });

    it("bids", async function() {
        const currentBlock = await ethers.provider.getBlockNumber();
        await bidder.maybeBid(currentBlock);
        assert.equal(
            (await burnAuction.getAuctioningSlotBid()).coordinator,
            await serviceSigner.getAddress()
        );
    });

    it("doesn't bid if already win", async function() {
        await contract.connect(serviceSigner).bid("1", { value: "1" });
        const currentBlock = await ethers.provider.getBlockNumber();
        // bid would result an error and thus fail the test
        await bidder.maybeBid(currentBlock);
    });

    it("doesn't bid if amount is too much", async function() {
        const amount = willingnessToBid.add("1");
        await contract.connect(competitor).bid(amount, { value: amount });
        const currentBlock = await ethers.provider.getBlockNumber();
        await bidder.maybeBid(currentBlock);
        assert.equal(
            (await burnAuction.getAuctioningSlotBid()).coordinator,
            await competitor.getAddress()
        );
    });
});
