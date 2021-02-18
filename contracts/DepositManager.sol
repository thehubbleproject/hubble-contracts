// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import { Types } from "./libs/Types.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Rollup } from "./rollup/Rollup.sol";

interface IDepositManager {
    event DepositQueued(uint256 pubkeyID, bytes data);
    event DepositSubTreeReady(uint256 subtreeID, bytes32 subtreeRoot);

    function dequeueToSubmit()
        external
        returns (uint256 subtreeID, bytes32 subtreeRoot);

    function reenqueue(bytes32 subtreeRoot) external;
}

contract SubtreeQueue {
    // Each element of the queue is a root of a subtree of deposits.
    mapping(uint256 => bytes32) public queue;
    uint256 public front = 1;
    uint256 public back = 0;

    event DepositSubTreeReady(uint256 subtreeID, bytes32 subtreeRoot);

    function enqueue(bytes32 subtreeRoot) internal {
        uint256 subtreeID = back + 1;
        back = subtreeID;
        queue[subtreeID] = subtreeRoot;
        emit DepositSubTreeReady(subtreeID, subtreeRoot);
    }

    function dequeue()
        internal
        returns (uint256 subtreeID, bytes32 subtreeRoot)
    {
        subtreeID = front;
        require(back >= subtreeID, "Deposit Core: Queue should be non-empty");
        subtreeRoot = queue[subtreeID];
        delete queue[subtreeID];
        front = subtreeID + 1;
    }
}

contract DepositCore is SubtreeQueue {
    // An element is a deposit tree root of any depth.
    // It could be just a leaf of a new deposit or
    // a root of a full grown subtree.
    mapping(uint256 => bytes32) public babyTrees;
    uint256 public babyTreesLength = 0;

    uint256 public depositCount = 0;

    uint256 public paramMaxSubtreeSize = 2;

    function insertAndMerge(bytes32 depositLeaf) internal {
        depositCount++;
        uint256 i = depositCount;

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
        if (depositCount == paramMaxSubtreeSize) {
            enqueue(babyTrees[0]);
            // reset
            babyTreesLength = 0;
            depositCount = 0;
        }
    }
}

contract DepositManager is DepositCore, IDepositManager {
    using Types for Types.UserState;
    using SafeERC20 for IERC20;
    address public vault;
    address public rollup;

    ITokenRegistry public tokenRegistry;

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
    ) public {
        tokenRegistry = _tokenRegistry;
        vault = _vault;
        paramMaxSubtreeSize = 1 << maxSubtreeDepth;
    }

    function setRollupAddress(address _rollup) public {
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
            l1Amount % l2Unit == 0,
            "l1Amount should be a multiple of l2Unit"
        );
        // transfer from msg.sender to vault
        require(
            IERC20(addr).allowance(msg.sender, address(this)) >= l1Amount,
            "token allowance not approved"
        );
        IERC20(addr).safeTransferFrom(msg.sender, vault, l1Amount);
        uint256 l2Amount = l1Amount / l2Unit;
        // create a new state
        Types.UserState memory newState = Types.UserState(
            pubkeyID,
            tokenID,
            l2Amount,
            0
        );
        // get new state hash
        bytes memory encodedState = newState.encode();
        emit DepositQueued(pubkeyID, encodedState);
        insertAndMerge(keccak256(encodedState));
    }

    function dequeueToSubmit()
        external
        override
        onlyRollup
        returns (uint256 subtreeID, bytes32 subtreeRoot)
    {
        return dequeue();
    }

    function reenqueue(bytes32 subtreeRoot) external override onlyRollup {
        enqueue(subtreeRoot);
    }
}
