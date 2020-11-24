pragma solidity ^0.5.15;
import { Chooser } from "./Chooser.sol";

contract BurnAuction {
    uint32 constant BLOCKS_PER_SLOT = 100;
    uint32 constant DELTA_BLOCKS_INITIAL_SLOT = 1000;

    // First block where the first slot begins
    uint256 public genesisBlock;

    // Bid is a structure indicating that
    // "operator" is willing to burn certain
    // "amount" of ether in order to forge a slot.
    // "initialized" is used to indicate that the bid is valid (used to differenciate an empty bid)
    struct Bid {
        address payable operator;
        uint128 amount;
        bool initialized;
    }

    // auction is a relation of the best bid for each slot
    mapping(uint32 => Bid) public auction;

    /**
     * @dev Event called when an operator beat the bestBid of the ongoing auction
     */
    event newBestBid(uint32 slot, address operator, uint128 amount);

    /**
     * @dev RollupBurnAuction constructor
     * Set first block where the slot will begin
     * Initializes auction for first slot
     * @param _rollup rollup main smart contract address
     */
    constructor(address _rollup) public {
        require(_rollup != address(0), "Address 0 inserted");
        genesisBlock = getBlockNumber() + DELTA_BLOCKS_INITIAL_SLOT;
    }

    /**
     * @dev Receive a bid from an operator. If the bid is higher than the current bid it replace the existing bid
     */
    function bid() external payable {
        uint32 auctionSlot = currentSlot() + 2;
        require(
            msg.value > auction[auctionSlot].amount,
            "Your bid doesn't beat the current best"
        );
        // refund, check 0 case (it means no bids yet for the auction, so no refund)
        // DISCUSSION: should we refund?
        if (auction[auctionSlot].initialized && auction[auctionSlot].amount > 0)
            auction[auctionSlot].operator.transfer(auction[auctionSlot].amount);
        // set new best bider
        auction[auctionSlot].operator = msg.sender;
        auction[auctionSlot].amount = uint128(msg.value);
        auction[auctionSlot].initialized = true;
        emit newBestBid(auctionSlot, msg.sender, uint128(msg.value));
    }

    function checkOffProposer() external returns (address) {
        require(
            auction[currentSlot()].initialized,
            "Auction has not been initialized"
        );
        return auction[currentSlot()].operator;
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
