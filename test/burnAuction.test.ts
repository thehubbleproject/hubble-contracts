// Tests borrowed from https://github.com/iden3/rollup/blob/master/test/contracts/RollupBurnAuction.test.js
import { assert, expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { toWei } from "../ts/utils";
import { MockRollup } from "../types/ethers-contracts/MockRollup";
import { MockRollupFactory } from "../types/ethers-contracts/MockRollupFactory";
import { TestBurnAuction } from "../types/ethers-contracts/TestBurnAuction";
import { TestBurnAuctionFactory } from "../types/ethers-contracts/TestBurnAuctionFactory";

const defaultAddress = "0x0000000000000000000000000000000000000000";
const BLOCKS_PER_SLOT = 100;
const DELTA_BLOCKS_INITIAL_SLOT = 1000;
const badBidMessage = "Your bid doesn't beat the current best";
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
        burnAuction = await new TestBurnAuctionFactory(signer).deploy();
        rollup = await new MockRollupFactory(signer).deploy(
            burnAuction.address
        );
        // mine blocks till the first slot begins
        await mineBlocksTillInitialSlot();
    });

    describe("Rollup Burn Auction: functional test - One entire auction process step by step, then multiple auctions with lots of bids", () => {
        it("slot 0 - Fails bidding on empty auction (slot 2, no account, no amount)", async () => {
            try {
                await burnAuction.bid();
                assert.fail("This shouldnt have been executed");
            } catch (error) {
                expect(error.message).to.include(badBidMessage);
            }
        });

        it("slot 0 - Fails forging an uninitialized auction", async () => {
            await failForge(signer1, uninitializedAuctionMessage);
        });

        it("slot 0 - Fails bidding on empty auction (slot 2, account 0, amount ==  0)", async () =>
            await failBid(signer1, "0"));

        it("slot 0 - Successfully bids on empty auction (slot 2, account 0, amount > 0)", async () =>
            await successBid(signer1, "2"));

        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, amount <  best bid amount)", async () =>
            await failBid(signer2, "1.999999999"));

        it("slot 0 - Fails bidding on initialized auction (slot 2, account 1, amount ==  best bid amount)", async () =>
            await failBid(signer2, "2"));

        it("slot 0 - Successfully bids on initialized auction (slot 2, account 1, amount >  best bid amount). This action causes a refund", async () =>
            await successBid(signer2, "2.0000001"));

        it("slot 0 => 1 - Moves to the next slot when BLOCKS_PER_SLOT blocks are mined", async () => {
            await mineBlocksTillNextSlot();
            // check winner of first auction (@ slot 2)
            const slot = await getAuction(2);
            expect(slot).to.eql({
                coordinator: await signer2.getAddress(),
                amount: "2000000100000000000",
                initialized: true
            });
            expect(await getSmartContractBalance()).to.be.equal(2.0000001);
        });

        it("slot 1 - Fails bidding on next auction (slot 3, account 0, amount ==  0)", async () =>
            await failBid(signer1, "0"));

        it("slot 1 - Successfully bids on next auction (slot 3, account 0, amount > 0).", async () =>
            await successBid(signer1, "1"));

        it("slot 1 => 2 - Moves to the next slot when BLOCKS_PER_SLOT blocks are mined", async () => {
            await mineBlocksTillNextSlot();
            // Check first forger and second winner
            const slots = [await getAuction(2), await getAuction(3)];
            expect(slots).to.eql([
                {
                    coordinator: await signer2.getAddress(),
                    amount: "2000000100000000000",
                    initialized: true
                },
                {
                    coordinator: await signer1.getAddress(),
                    amount: "1000000000000000000",
                    initialized: true
                }
            ]);
            expect(await getSmartContractBalance()).to.be.equal(3.0000001);
        });

        it("slot 2 - Fails Forging batch (unauthorized coordinator)", async () =>
            await failForge(signer1, badForgeMessage));

        it("slot 2 - Successfully forges batch", async () => {
            await successForge(signer2);
            // Winner can forge as many batches as they like in the slot
            await successForge(signer2);
        });

        it("slot 2 - Bids nBids times on the current auction (slot 4), forward 2 slots and check status. Note that there will be a slot that wont receive bids", async () => {
            // Do nBids
            const nBids = 20;
            let bestBid = {
                amount: 0,
                addr: ""
            };
            const signers = await ethers.getSigners();
            // small number of participants to increase probability of same bidder beating his own bid
            const nParticipants = signers.length < 3 ? signers.length : 3;
            for (let i = 0; i < nBids; i++) {
                // choose a random bidder
                const signer =
                    signers[Math.floor(Math.random() * nParticipants)];
                // alternate between succesfull and unsuccesfull bid
                const amount =
                    i % 2
                        ? Math.floor((bestBid.amount + 0.000001) * 100000000) /
                          100000000
                        : bestBid.amount;
                if (amount > bestBid.amount) {
                    await successBid(signer, `${amount}`);
                    bestBid = { amount, addr: signer.address };
                } else await failBid(signer, `${amount}`);
            }

            // Forward two slots
            await mineBlocksTillNextSlot();
            await mineBlocksTillNextSlot();
            // Extra bid just for fun
            await successBid(signer1, "0.0000001");

            // Get auction status
            const slots = [
                await getAuction(4),
                await getAuction(5),
                await getAuction(6)
            ];

            const bestBidAmount = toWei(`${bestBid.amount}`);

            // Check results
            expect(slots).to.eql([
                {
                    coordinator: bestBid.addr,
                    amount: bestBidAmount.toString(),
                    initialized: true
                },
                {
                    coordinator: defaultAddress,
                    amount: "0",
                    initialized: false
                },
                {
                    coordinator: await signer1.getAddress(),
                    amount: "100000000000",
                    initialized: true
                }
            ]);
            expect((await getSmartContractBalance()).toFixed(5)).to.be.equal(
                (3.0000002 + bestBid.amount).toFixed(5)
            );
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

    async function successBid(signer: Signer, bid: string) {
        // Get status before new bid
        const bidWei = toWei(bid);
        const newBidderPrevBalance = await signer.getBalance();
        const prevBestBid = await getCurrentAuction();
        const oldBidderPrevBalnce = await getEtherBalance(
            prevBestBid.coordinator
        );

        // Bid and get updated balance
        const tx = await burnAuction.connect(signer).bid({ value: bidWei });
        const receipt = await tx.wait();

        const [event] = await burnAuction.queryFilter(
            burnAuction.filters.newBestBid(null, null, null),
            tx.blockHash
        );

        const paidInGas = receipt.gasUsed.mul(
            await ethers.provider.getGasPrice()
        );
        const newBidderNxtBalance = await signer.getBalance();
        const oldBidderNxtBalance = await getEtherBalance(
            prevBestBid.coordinator
        );

        expect(event.args?.amount.toString()).to.be.equal(bidWei.toString());

        // If the previous bidder and the current bidder are the same
        if ((await signer.getAddress()) === prevBestBid.coordinator) {
            // Ignore address 0
            if (prevBestBid.coordinator !== defaultAddress) {
                let prevBid = "0";
                // if the previous auction and the current auction are the same (same slot) (refund situation)
                if (prevBestBid.slot == event.args?.slot)
                    prevBid = prevBestBid.amount;
                const diff = newBidderNxtBalance.sub(
                    newBidderPrevBalance
                        .sub(toWei(bid))
                        .sub(paidInGas)
                        .add(prevBid)
                );
                expect(diff.toNumber()).to.be.equal(0);
            }
        }
        // If the previous bidder and the current bidder are NOT the same
        else {
            const diff = newBidderNxtBalance.sub(
                newBidderPrevBalance.sub(toWei(bid)).sub(paidInGas)
            );
            expect(diff.toNumber()).to.be.equal(0);
            // if the previous auction and the current auction are the same (same slot ==> refund) + Ignore address 0
            if (
                prevBestBid.slot == event.args?.slot &&
                prevBestBid.coordinator !== defaultAddress
            ) {
                const prevBid = prevBestBid.amount;
                expect(
                    oldBidderPrevBalnce
                        .add(prevBid)
                        .sub(oldBidderNxtBalance)
                        .toNumber()
                ).to.be.equal(0);
            }
        }
    }

    async function failBid(signer: Signer, bid: string) {
        const oldBalance = await signer.getBalance();
        try {
            await burnAuction.connect(signer).bid({ value: toWei(bid) });
            assert.fail("This shouldnt have been executed");
        } catch (error) {
            expect(error.message).to.include(badBidMessage);
            const newBalance = await signer.getBalance();
            expect(oldBalance.toString()).to.equal(newBalance.toString());
        }
    }

    async function successForge(signer: Signer) {
        await rollup.connect(signer).submitBatch();
    }

    async function failForge(signer: Signer, failMessage: string) {
        try {
            await rollup.connect(signer).submitBatch();
            assert.fail("This shouldnt have been executed");
        } catch (error) {
            expect(error.message).to.include(failMessage);
        }
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
