// Modified from https://github.com/iden3/rollup/blob/master/contracts/RollupBurnAuction.sol
pragma solidity ^0.5.15;
import { Chooser } from "./Chooser.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract BurnAuction is Chooser {
    using SafeMath for uint256;

    uint32 constant BLOCKS_PER_SLOT = 100;
    uint32 constant DELTA_BLOCKS_INITIAL_SLOT = 1000;

    // Donation address that is fed with portion of burned amount
    address payable donationTarget;

    // Donation amout that can be withdrawn with withdrawDonation is accumulated
    uint256 donationAccumulator;

    // First block where the first slot begins
    uint256 public genesisBlock;

    // Bid is a structure indicating that
    // "coordinator" is willing to burn certain
    // "amount" of ether in order to forge a slot.
    // "initialized" is used to indicate that the bid is valid (used to differenciate an empty bid)
    struct Bid {
        address payable coordinator;
        uint128 amount;
        bool initialized;
    }

    // auction is a relation of the best bid for each slot
    mapping(uint32 => Bid) public auction;

    /**
     * @dev Event called when an coordinator beat the bestBid of the ongoing auction
     */
    event NewBestBid(uint32 slot, address coordinator, uint128 amount);

    /**
     * @dev RollupBurnAuction constructor
     * Set first block where the slot will begin
     * Initializes auction for first slot
     */
    constructor(address payable _donationTarget) public {
        genesisBlock = getBlockNumber() + DELTA_BLOCKS_INITIAL_SLOT;
        donationTarget = _donationTarget;
    }

    /**
     * @dev Receive a bid from an coordinator. If the bid is higher than the current bid it replace the existing bid
     */
    function bid() external payable {
        uint32 auctionSlot = currentSlot() + 2;

        // if not initialized it must be 0
        uint256 latestBidAmount = auction[auctionSlot].amount;
        uint256 bidAmount = msg.value;

        require(
            bidAmount > latestBidAmount,
            "Your bid doesn't beat the current best"
        );

        // refund, check 0 case (it means no bids yet for the auction, so no refund)
        if (auction[auctionSlot].initialized && auction[auctionSlot].amount > 0)
            auction[auctionSlot].coordinator.transfer(latestBidAmount);

        // update donation accumulator
        // TODO: use safe math
        donationAccumulator = donationAccumulator.sub(latestBidAmount);
        donationAccumulator = donationAccumulator.add(bidAmount);

        // set new best bider
        auction[auctionSlot].coordinator = msg.sender;
        auction[auctionSlot].amount = uint128(msg.value);
        auction[auctionSlot].initialized = true;
        emit NewBestBid(auctionSlot, msg.sender, uint128(msg.value));
    }

    function getProposer() external view returns (address) {
        uint32 _currentSlot = currentSlot();
        require(
            auction[_currentSlot].initialized,
            "Auction has not been initialized"
        );
        return auction[_currentSlot].coordinator;
    }

    function withdrawDonation() external {
        donationTarget.transfer(donationAccumulator);
        donationAccumulator = 0;
    }

    /**
     * @dev Calculate slot from block number
     * @param numBlock block number
     * @return slot number
     */
    function block2slot(uint256 numBlock) public view returns (uint32) {
        if (numBlock < genesisBlock) return 0;
        return uint32((numBlock - genesisBlock) / (BLOCKS_PER_SLOT));
    }

    /**
     * @dev Retrieve current slot
     * @return slot number
     */
    function currentSlot() public view returns (uint32) {
        return block2slot(getBlockNumber());
    }

    /**
     * @dev Retrieve block number. THIS FUNCTION IS USEFULL FOR DEBUGGING PURPOSES
     * @return current block number
     */
    function getBlockNumber() public view returns (uint256) {
        return block.number;
    }
}
