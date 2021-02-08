// SPDX-License-Identifier: MIT
// Modified from https://github.com/iden3/rollup/blob/master/contracts/RollupBurnAuction.sol
pragma solidity ^0.6.12;
import { Chooser } from "./Chooser.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract BurnAuction is Chooser {
    using SafeMath for uint256;

    uint32 public constant BLOCKS_PER_SLOT = 10;
    uint32 public constant DELTA_BLOCKS_INITIAL_SLOT = 1;

    // donation numerator and demoninator are used to calculate donation amount
    uint256 public constant DONATION_DENOMINATOR = 10000;
    uint256 public donationNumerator;

    // Donation address that is fed with portion of burned amount
    address payable public donationAddress;

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

    // deposits is current balances of coordinators that can used for next bids
    mapping(address => uint256) public deposits;

    /**
     * @dev Event called when an coordinator beat the bestBid of the ongoing auction
     */
    event NewBestBid(uint32 slot, address coordinator, uint256 amount);

    /**
     * @dev RollupBurnAuction constructor
     * Set first block where the slot will begin
     * Initializes auction for first slot
     */
    constructor(address payable _donationAddress, uint256 _donationNumerator)
        public
    {
        require(
            donationNumerator <= DONATION_DENOMINATOR,
            "BurnAuction, constructor: bad denominator"
        );

        genesisBlock = getBlockNumber() + DELTA_BLOCKS_INITIAL_SLOT;
        donationAddress = _donationAddress;
        donationNumerator = _donationNumerator;
    }

    function deposit(address beneficiary) external payable {
        updateBalance(beneficiary, msg.value, 0);
    }

    /**
     * @dev Receive a bid from an coordinator. If the bid is higher than the current bid it replace the existing bid
     */
    function bid(uint256 bidAmount) external payable {
        uint32 auctionSlot = currentSlot() + 2;
        // if not initialized it must be 0
        uint256 currentBidAmount = auction[auctionSlot].amount;
        require(
            bidAmount > currentBidAmount,
            "BurnAuction, bid: less then current"
        );
        address coordinator = msg.sender;
        require(
            deposits[coordinator] + msg.value >= bidAmount,
            "BurnAuction, bid: insufficient funds for bidding"
        );
        // update balances
        // refund previous coordinator
        updateBalance(auction[auctionSlot].coordinator, currentBidAmount, 0);
        // update donation balance
        updateBalance(
            donationAddress,
            bidAmount.mul(donationNumerator).div(DONATION_DENOMINATOR),
            currentBidAmount.mul(donationNumerator).div(DONATION_DENOMINATOR)
        );
        // update coordinator with remaining value
        updateBalance(coordinator, msg.value, bidAmount);
        // set new best bider
        auction[auctionSlot].coordinator = msg.sender;
        auction[auctionSlot].amount = uint128(bidAmount);
        auction[auctionSlot].initialized = true;
        emit NewBestBid(auctionSlot, coordinator, bidAmount);
    }

    function getProposer() external view override returns (address) {
        uint32 _currentSlot = currentSlot();
        require(
            auction[_currentSlot].initialized,
            "Auction has not been initialized"
        );
        return auction[_currentSlot].coordinator;
    }

    function withdrawDonation() external {
        require(
            deposits[donationAddress] != 0,
            "BurnAuction, withdrawDonation: donation deposit is zero"
        );
        uint256 donationAmount = deposits[donationAddress];
        deposits[donationAddress] = 0;
        donationAddress.transfer(donationAmount);
    }

    function withdraw(uint256 amount) external {
        address payable claimer = msg.sender;
        require(
            deposits[claimer] >= amount,
            "BurnAuction, withdraw: insufficient deposit amount for withdraw"
        );
        updateBalance(claimer, 0, amount);
        claimer.transfer(amount);
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
    function getBlockNumber() public view virtual returns (uint256) {
        return block.number;
    }

    function updateBalance(
        address addr,
        uint256 incr,
        uint256 decr
    ) internal {
        if (addr != address(0)) {
            uint256 balance = deposits[addr];
            balance = balance.add(incr);
            balance = balance.sub(decr);
            deposits[addr] = balance;
        }
    }
}
