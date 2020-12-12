// Tests borrowed from https://github.com/iden3/rollup/blob/master/test/contracts/RollupBurnAuction.test.js
import { assert, expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { formatEther, isAddress } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expectRevert, toWei } from "../ts/utils";
import { MockRollup } from "../types/ethers-contracts/MockRollup";
import { MockRollupFactory } from "../types/ethers-contracts/MockRollupFactory";
import { TestBurnAuction } from "../types/ethers-contracts/TestBurnAuction";
import { TestBurnAuctionFactory } from "../types/ethers-contracts/TestBurnAuctionFactory";

const zeroAddress = "0x0000000000000000000000000000000000000000";
const donationAddress = "0x00000000000000000000000000000000000000d0";
const BLOCKS_PER_SLOT = 100;
const DELTA_BLOCKS_INITIAL_SLOT = 1000;
const badBidMessage = "Your bid doesn't beat the current best";

const badBidLessThanCurrentMessage = "BurnAuction, bid: less then current";
const badBidInsufficienttMessage =
    "BurnAuction, bid: insufficient funds for bidding";

const badForgeMessage = "Invalid proposer";
const uninitializedAuctionMessage = "Auction has not been initialized";

describe("BurnAuction", function() {
    let burnAuction: TestBurnAuction;
    let rollup: MockRollup;
    let signer1: Signer;
    let signer2: Signer;

    before(async () => {
        let signer: Signer;
        [signer, signer1, signer2] = await ethers.getSigners();

        burnAuction = await new TestBurnAuctionFactory(signer).deploy(
            donationAddress
        );
        rollup = await new MockRollupFactory(signer).deploy(
            burnAuction.address
        );
        // mine blocks till the first slot begins
        await mineBlocksTillInitialSlot();
    });

    describe("Rollup Burn Auction: functional test - One entire auction process step by step, then multiple auctions with lots of bids", () => {
        it("slot 0 - Fails forging an uninitialized auction", async () => {
            await failForge(signer1, uninitializedAuctionMessage);
        });
        it("slot 0 - Fails bidding on empty auction (slot 2, account 0, amount ==  0)", async () => {
            await failBid(signer1, "0", "0", badBidLessThanCurrentMessage);
        });
        it("slot 0 - Fails bidding on empty auction (slot 2, account 0, amount ==  0)", async () => {
            await failBid(signer1, "1", "0", badBidInsufficienttMessage);
        });
        it("slot 0 - Successfully bids on empty auction (slot 2, account 0, amount > 0)", async () => {
            const bidAmount = "2";
            const value = "5";
            await successBid(signer1, bidAmount, value);
        });
        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, less than current)", async () => {
            const bidAmount = "1.999999999";
            const value = "1.999999999";
            await failBid(
                signer2,
                bidAmount,
                value,
                badBidLessThanCurrentMessage
            );
        });
        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, equal to current)", async () => {
            const bidAmount = "2";
            const value = "2";
            await failBid(
                signer2,
                bidAmount,
                value,
                badBidLessThanCurrentMessage
            );
        });
        it("slot 0 - Successfully bids on empty auction (slot 2, account 0, raise bid)", async () => {
            const bidAmount = "3";
            const value = "0";
            await successBid(signer1, bidAmount, value);
        });
        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, insufficient)", async () => {
            const bidAmount = "4";
            const value = "0";
            await failBid(
                signer2,
                bidAmount,
                value,
                badBidInsufficienttMessage
            );
        });
        it("slot 0 - Successfully bids on empty auction (slot 2, account 0, take over)", async () => {
            const bidAmount = "4";
            const value = "4";
            await successBid(signer2, bidAmount, value);
            const slot = await getAuction(2);
            expect(slot).to.eql({
                coordinator: await signer2.getAddress(),
                amount: toWei(bidAmount),
                initialized: true
            });
        });

        it("slot 1 - Fails bidding on next auction (slot 3, account 0, amount ==  0)", async () => {
            await mineBlocksTillNextSlot();
            assert.equal(1, await getSlot());
            await failBid(signer1, "0", "0", badBidLessThanCurrentMessage);
        });

        it("slot 1 - Successfully bids on next auction (slot 3, account 0, amount > 0).", async () => {
            await successBid(signer1, "1", "0");
            let slot = await getAuction(2);
            expect(slot).to.eql({
                coordinator: await signer2.getAddress(),
                amount: toWei("4"),
                initialized: true
            });
            slot = await getAuction(3);
            expect(slot).to.eql({
                coordinator: await signer1.getAddress(),
                amount: toWei("1"),
                initialized: true
            });
        });

        it("slot 2 - Fails Forging batch (unauthorized coordinator)", async () => {
            await mineBlocksTillNextSlot();
            assert.equal(2, await getSlot());
            await failForge(signer1, badForgeMessage);
        });

        it("slot 2 - Fails Forging batch (unauthorized coordinator)", async () =>
            await failForge(signer1, badForgeMessage));

        it("slot 2 - Successfully forges batch", async () => {
            await successForge(signer2);
            // Winner can forge as many batches as they like in the slot
            await successForge(signer2);
        });
    });

    async function mineBlocksTillInitialSlot() {
        // Get current slot and block
        const genesisSlot = await getSlot();
        const currentBlock = Number(await burnAuction.getBlockNumber());
        // Forward enought blocks to get to the inital slot
        await burnAuction.setBlockNumber(
            currentBlock + DELTA_BLOCKS_INITIAL_SLOT
        );
        // Check results
        const currentSlot = await getSlot();
        expect(genesisSlot + currentSlot).to.equal(0);
    }

    async function mineBlocksTillNextSlot() {
        // Get current slot and block
        const currentSlot = await getSlot();
        const currentBlock = Number(await burnAuction.getBlockNumber());
        // Forward enought blocks to get to next slot
        await burnAuction.setBlockNumber(currentBlock + BLOCKS_PER_SLOT);
        // Check results
        const nextSlot = await getSlot();
        expect(nextSlot - currentSlot).to.equal(1);
    }

    async function successBid(
        signer: Signer,
        bidAmount: string,
        value: string
    ) {
        const bidAmountWei = toWei(bidAmount);
        const valueWei = toWei(value);

        const _burnAuction = burnAuction.connect(signer);
        const coordinator = await signer.getAddress();
        const prevBid = await getCurrentAuction();
        const prevBidAmountWei = prevBid.amount;
        const prevCoordinator = prevBid.coordinator;

        const burnAuctionPrevBalance = await getEtherBalance(
            _burnAuction.address
        );
        const newBidderPrevDeposit = await _burnAuction.deposits(coordinator);
        const oldBidderPrevDeposit = await _burnAuction.deposits(
            prevCoordinator
        );

        const tx = await _burnAuction.bid(bidAmountWei, { value: valueWei });
        await tx.wait();

        const [event] = await burnAuction.queryFilter(
            burnAuction.filters.NewBestBid(null, null, null),
            tx.blockHash
        );

        const burnAuctionNextBalance = await getEtherBalance(
            _burnAuction.address
        );
        const newBidderNextDeposit = await _burnAuction.deposits(coordinator);
        const oldBidderNextDeposit = await _burnAuction.deposits(
            prevCoordinator
        );

        expect(event.args?.amount.toString()).to.be.equal(bidAmountWei);
        expect(event.args?.coordinator).to.be.equal(coordinator);

        const bestBid = await getCurrentAuction();
        expect(bestBid.initialized).to.be.equal(true);
        expect(bestBid.coordinator).to.be.equal(coordinator);

        expect(bestBid.amount.toString()).to.be.equal(bidAmountWei);

        expect(burnAuctionPrevBalance.add(valueWei).toString()).to.be.equal(
            burnAuctionNextBalance.toString()
        );

        if (
            prevCoordinator !== coordinator &&
            prevCoordinator !== zeroAddress
        ) {
            expect(
                oldBidderPrevDeposit.add(prevBidAmountWei).toString()
            ).to.be.equal(oldBidderNextDeposit.toString());
            expect(
                newBidderPrevDeposit
                    .add(valueWei)
                    .sub(bidAmountWei)
                    .toString()
            ).to.be.equal(newBidderNextDeposit.toString());
        } else {
            expect(
                newBidderPrevDeposit
                    .add(prevBidAmountWei)
                    .add(valueWei)
                    .sub(bidAmountWei)
                    .toString()
            ).to.be.equal(newBidderNextDeposit.toString());
        }
    }

    async function failBid(
        signer: Signer,
        bidAmount: string,
        value: string,
        withMessage: string
    ) {
        const _burnAuction = burnAuction.connect(signer);
        const oldBalance = await signer.getBalance();
        const oldDeposit = await _burnAuction.deposits(
            await signer.getAddress()
        );

        await expectRevert(
            _burnAuction.bid(toWei(bidAmount), { value: toWei(value) }),
            withMessage
        );

        const newBalance = await signer.getBalance();
        const newDeposit = await _burnAuction.deposits(
            await signer.getAddress()
        );

        expect(oldDeposit.toString()).to.equal(newDeposit.toString());
        expect(oldBalance.toString()).to.equal(newBalance.toString());
    }

    async function successForge(signer: Signer) {
        await rollup.connect(signer).submitBatch();
    }

    async function failForge(signer: Signer, failMessage: string) {
        await expectRevert(rollup.connect(signer).submitBatch(), failMessage);
    }

    async function getEtherBalance(address: string): Promise<BigNumber> {
        return await ethers.provider.getBalance(address);
    }

    async function getSlot() {
        return Number(await burnAuction.currentSlot());
    }

    async function getAuction(slot: number) {
        const auction = await burnAuction.auction(slot);
        return {
            amount: auction.amount.toString(),
            initialized: auction.initialized,
            coordinator: auction.coordinator
        };
    }

    async function getCurrentAuction() {
        const currentAuctionSlot = (await getSlot()) + 2;
        const currentAucttion = await getAuction(currentAuctionSlot);
        return {
            slot: currentAuctionSlot,
            ...currentAucttion
        };
    }

    async function getSmartContractBalance() {
        return Number(formatEther(await getEtherBalance(burnAuction.address)));
    }
});
