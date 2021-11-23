// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/Initializable.sol";
import { Types } from "./libs/Types.sol";
import { ImmutableOwnable } from "./libs/ImmutableOwnable.sol";
import { Rollup } from "./rollup/Rollup.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";

/**
 * @notice Interface for a contract acting as a manager of deposits for a Hubble network
 */
interface IDepositManager {
    /**
     * @notice Event when a deposit has been enqueued
     * for eventual submission to the rollup
     * @param pubkeyID Registered public key ID
     * @param tokenID Registered token ID
     * @param l2Amount UserState.balance of deposit
     * @param subtreeID Subtree this deposit will be part of (1 ... n)
     * @param depositID Deposit number in the subtree (0 ... 1 << maxSubtreeDepth)
     */
    event DepositQueued(
        uint256 pubkeyID,
        uint256 tokenID,
        uint256 l2Amount,
        uint256 subtreeID,
        uint256 depositID
    );
    /**
     * @notice Event when a deposit subtree is ready
     * to be submitted to the rollup
     * @param subtreeID Subtree ID of deposits (1 ... n)
     * @param subtreeRoot Merklized root of subtree
     */
    event DepositSubTreeReady(uint256 subtreeID, bytes32 subtreeRoot);

    /**
     * @notice Max subtree depth for queued deposits
     */
    function paramMaxSubtreeDepth() external returns (uint256);

    /**
     * @notice Dequeues a deposit subtree for submission to the rollup
     */
    function dequeueToSubmit()
        external
        returns (uint256 subtreeID, bytes32 subtreeRoot);

    /**
     * @notice Re-enqueues a deposit subtree.
     * @param subtreeRoot Merklized root of subtree
     */
    function reenqueue(bytes32 subtreeRoot) external;
}

/**
 * @notice Contract which is a queue for deposit subtrees
 * @dev subtreeID starts at 1
 */
contract SubtreeQueue {
    // Each element of the queue is a root of a subtree of deposits.
    mapping(uint256 => bytes32) public queue;
    uint256 public front = 1;
    uint256 public back = 0;

    event DepositSubTreeReady(uint256 subtreeID, bytes32 subtreeRoot);

    function unshift(bytes32 subtreeRoot) internal {
        uint256 subtreeID = front - 1;
        require(subtreeID > 0, "Deposit Core: No subtrees to unshift");
        front = subtreeID;
        queue[subtreeID] = subtreeRoot;
    }

    function push(bytes32 subtreeRoot) internal returns (uint256 subtreeID) {
        subtreeID = back + 1;
        back = subtreeID;
        queue[subtreeID] = subtreeRoot;
        emit DepositSubTreeReady(subtreeID, subtreeRoot);
    }

    function shift() internal returns (uint256 subtreeID, bytes32 subtreeRoot) {
        subtreeID = front;
        require(back >= subtreeID, "Deposit Core: Queue should be non-empty");
        subtreeRoot = queue[subtreeID];
        delete queue[subtreeID];
        front = subtreeID + 1;
    }
}

/**
 * @notice Contract which merges deposits into subtrees
 * @dev subtreeID starts at 1
 */
contract DepositCore is SubtreeQueue {
    // An element is a deposit tree root of any depth.
    // It could be just a leaf of a new deposit or
    // a root of a full grown subtree.
    mapping(uint256 => bytes32) public babyTrees;
    uint256 public babyTreesLength = 0;

    uint256 public depositCount = 0;

    uint256 public immutable paramMaxSubtreeSize;

    constructor(uint256 maxSubtreeDepth) public {
        paramMaxSubtreeSize = 1 << maxSubtreeDepth;
    }

    function insertAndMerge(bytes32 depositLeaf)
        internal
        returns (uint256 subtreeID, uint256 depositID)
    {
        depositID = depositCount;
        uint256 numDeposits = depositID + 1;

        uint256 i = numDeposits;
        uint256 len = babyTreesLength;
        babyTrees[len] = depositLeaf;
        len++;
        // As long as we have a pair to merge, we merge
        // the number of iteration is bounded by maxSubtreeDepth
        while (i & 1 == 0) {
            // Override the left node with the merged left and right nodes
            babyTrees[len - 2] = keccak256(
                abi.encode(babyTrees[len - 2], babyTrees[len - 1])
            );
            len--;
            i >>= 1;
        }
        babyTreesLength = len;

        // Subtree is ready, send to SubtreeQueue
        if (numDeposits == paramMaxSubtreeSize) {
            subtreeID = push(babyTrees[0]);
            // reset
            babyTreesLength = 0;
            depositCount = 0;
            return (subtreeID, depositID);
        }

        subtreeID = back + 1;
        depositCount = numDeposits;
    }
}

/**
 * @notice Contract which manages deposits. Most functions are
 * restricted only for the rollup's use. Most Hubble users need
 * only call depositFor.
 * @dev subtreeID starts at 1
 */
contract DepositManager is
    DepositCore,
    IDepositManager,
    Initializable,
    ImmutableOwnable
{
    using Types for Types.UserState;
    using SafeERC20 for IERC20;

    uint256 public immutable override paramMaxSubtreeDepth;
    address public immutable vault;
    // Can't be immutable yet. Since the rollup is deployed after DepositManager
    address public rollup;

    ITokenRegistry public immutable tokenRegistry;

    modifier onlyRollup() {
        require(
            msg.sender == rollup,
            "DepositManager: sender is not Rollup contract"
        );
        _;
    }

    constructor(
        ITokenRegistry _tokenRegistry,
        address _vault,
        uint256 maxSubtreeDepth
    ) public DepositCore(maxSubtreeDepth) {
        paramMaxSubtreeDepth = maxSubtreeDepth;
        tokenRegistry = _tokenRegistry;
        vault = _vault;
    }

    /**
     * @notice Sets Rollup contract address. Can only be called once by owner
     * @dev We assume DepositManager is deployed before Rollup
     * @param _rollup Rollup contract address
     */
    function setRollupAddress(address _rollup) external initializer onlyOwner {
        rollup = _rollup;
    }

    /**
     * @notice Adds a deposit for an address to the deposit queue
     * @param l1Amount Number of tokens that user wants to deposit
     * @param tokenID Type of token user is depositing
     */
    function depositFor(
        uint256 pubkeyID,
        uint256 l1Amount,
        uint256 tokenID
    ) external {
        (address addr, uint256 l2Unit) = tokenRegistry.safeGetRecord(tokenID);
        require(
            l1Amount == 0 || l1Amount % l2Unit == 0,
            "l1Amount should be a multiple of l2Unit"
        );
        // transfer from msg.sender to vault
        uint256 l2Amount = 0;
        if (l1Amount > 0) {
            require(
                IERC20(addr).allowance(msg.sender, address(this)) >= l1Amount,
                "token allowance not approved"
            );
            IERC20(addr).safeTransferFrom(msg.sender, vault, l1Amount);
            l2Amount = l1Amount / l2Unit;
        }
        // create a new state
        Types.UserState memory newState =
            Types.UserState(pubkeyID, tokenID, l2Amount, 0);
        // get new state hash
        bytes memory encodedState = newState.encode();
        (uint256 subtreeID, uint256 depositID) =
            insertAndMerge(keccak256(encodedState));
        emit DepositQueued(pubkeyID, tokenID, l2Amount, subtreeID, depositID);
    }

    function dequeueToSubmit()
        external
        override
        onlyRollup
        returns (uint256 subtreeID, bytes32 subtreeRoot)
    {
        return shift();
    }

    function reenqueue(bytes32 subtreeRoot) external override onlyRollup {
        unshift(subtreeRoot);
    }
}
