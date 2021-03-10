import { Signer } from "@ethersproject/abstract-signer";
import { BigNumber } from "@ethersproject/bignumber";
import { assert } from "chai";
import { ethers } from "hardhat";
import { BurnAuctionService } from "../../ts/client/services/burnAuction";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { mineBlocks } from "../../ts/utils";
import { BurnAuctionFactory } from "../../types/ethers-contracts";
import { BurnAuction } from "../../types/ethers-contracts/BurnAuction";

describe("Burn Auction service", function() {
    let deployer: Signer;
    let serviceSigner: Signer;
    let competitor: Signer;
    let burnAuction: BurnAuction;
    let service: BurnAuctionService;
    const willingnessToBid = BigNumber.from("1");

    beforeEach(async function() {
        [deployer, serviceSigner, competitor] = await ethers.getSigners();
        burnAuction = await new BurnAuctionFactory(deployer).deploy(
            PRODUCTION_PARAMS.DONATION_ADDRESS,
            PRODUCTION_PARAMS.DONATION_NUMERATOR
        );
        const initialBlocks = await burnAuction.DELTA_BLOCKS_INITIAL_SLOT();
        const blocksPerSlot = await burnAuction.BLOCKS_PER_SLOT();
        service = await BurnAuctionService.new(
            willingnessToBid,
            burnAuction.connect(serviceSigner)
        );
        await mineBlocks(ethers.provider, initialBlocks + blocksPerSlot);
    });

    it("bids", async function() {
        const currentSlot = await burnAuction.currentSlot();
        const currentBlock = await ethers.provider.getBlockNumber();
        await service.maybeBid(currentBlock);
        assert.equal(
            (await burnAuction.auction(currentSlot + 2)).coordinator,
            await serviceSigner.getAddress()
        );
    });

    it("doesn't bid if already win", async function() {
        await burnAuction.connect(serviceSigner).bid("1", { value: "1" });
        const currentBlock = await ethers.provider.getBlockNumber();
        // bid would result an error and thus fail the test
        await service.maybeBid(currentBlock);
    });

    it("doesn't bid if amount is too much", async function() {
        const amount = willingnessToBid.add("1");
        await burnAuction.connect(competitor).bid(amount, { value: amount });
        const currentBlock = await ethers.provider.getBlockNumber();
        await service.maybeBid(currentBlock);
        const currentSlot = await burnAuction.currentSlot();
        assert.equal(
            (await burnAuction.auction(currentSlot + 2)).coordinator,
            await competitor.getAddress()
        );
    });
});
