pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Types } from "./libs/Types.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Rollup } from "./rollup/Rollup.sol";

interface IDepositManager {
    event DepositQueued(uint256 pubkeyID, bytes data);
    event DepositSubTreeReady(bytes32 root);

    function dequeueToSubmit() external returns (bytes32 subtreeRoot);

    function reenqueue(bytes32 subtreeRoot) external;
}

contract SubtreeQueue {
    // Each element of the queue is a root of a subtree of deposits.
    mapping(uint256 => bytes32) public queue;
    uint256 public front = 1;
    uint256 public back = 0;

    function enqueue(bytes32 subtreeRoot) internal {
        back += 1;
        queue[back] = subtreeRoot;
    }

    function dequeue() internal returns (bytes32 subtreeRoot) {
        require(back >= front, "Deposit Core: Queue should be non-empty");
        subtreeRoot = queue[front];
        delete queue[front];
        front += 1;
    }
}

contract DepositCore is SubtreeQueue {
    // An element in this array is a deposit tree root of any depth.
    // It could be just a leaf of a new deposit or
    // a root of a full grown subtree.
    bytes32[] public babyTrees;
    uint256 public depositCount = 0;

    uint256 public paramMaxSubtreeSize = 2;

    function insertAndMerge(bytes32 depositLeaf)
        internal
        returns (bytes32 readySubtree)
    {
        babyTrees.push(depositLeaf);
        depositCount++;
        uint256 i = depositCount;
        // As long as we have a pair to merge, we merge
        // the number of iteration is bounded by maxSubtreeDepth
        while (i & 1 == 0) {
            // Override the left node with the merged result
            babyTrees[babyTrees.length - 2] = keccak256(
                abi.encode(
                    // left node
                    babyTrees[babyTrees.length - 2],
                    // right node
                    babyTrees[babyTrees.length - 1]
                )
            );
            // Discard the right node
            delete babyTrees[babyTrees.length - 1];
            babyTrees.length--;

            i >>= 1;
        }
        // Subtree is ready, send to SubtreeQueue
        if (depositCount == paramMaxSubtreeSize) {
            readySubtree = babyTrees[0];
            enqueue(readySubtree);
            reset();
        } else {
            readySubtree = bytes32(0);
        }
    }

    function reset() internal {
        // Reset babyTrees
        uint256 numberOfDeposits = babyTrees.length;
        for (uint256 i = 0; i < numberOfDeposits; i++) {
            delete babyTrees[i];
        }
        babyTrees.length = 0;
        // Reset depositCount
        depositCount = 0;
    }
}

contract DepositManager is DepositCore, IDepositManager {
    using Types for Types.UserState;
    Registry public nameRegistry;
    address public vault;

    ITokenRegistry public tokenRegistry;

    modifier onlyRollup() {
        require(
            msg.sender ==
                nameRegistry.getContractDetails(ParamManager.rollupCore()),
            "DepositManager: sender is not Rollup contract"
        );
        _;
    }

    constructor(address _registryAddr, uint256 maxSubtreeDepth) public {
        nameRegistry = Registry(_registryAddr);
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.tokenRegistry())
        );
        vault = nameRegistry.getContractDetails(ParamManager.vault());
        paramMaxSubtreeSize = 1 << maxSubtreeDepth;
    }

    /**
     * @notice Adds a deposit for an address to the deposit queue
     * @param amount Number of tokens that user wants to deposit
     * @param tokenID Type of token user is depositing
     */
    function depositFor(
        uint256 accountID,
        uint256 amount,
        uint256 tokenID
    ) external {
        // check amount is greater than 0
        require(amount > 0, "token deposit must be greater than 0");
        IERC20 tokenContract = IERC20(tokenRegistry.safeGetAddress(tokenID));
        // transfer from msg.sender to vault
        require(
            tokenContract.allowance(msg.sender, address(this)) >= amount,
            "token allowance not approved"
        );
        require(
            tokenContract.transferFrom(msg.sender, vault, amount),
            "token transfer not approved"
        );
        // create a new state
        Types.UserState memory newState = Types.UserState(
            accountID,
            tokenID,
            amount,
            0
        );
        // get new state hash
        bytes memory encodedState = newState.encode();
        emit DepositQueued(accountID, encodedState);
        bytes32 readySubtree = insertAndMerge(keccak256(encodedState));
        if (readySubtree != bytes32(0)) {
            emit DepositSubTreeReady(readySubtree);
        }
    }

    function dequeueToSubmit()
        external
        onlyRollup
        returns (bytes32 subtreeRoot)
    {
        return dequeue();
    }

    function reenqueue(bytes32 subtreeRoot) external onlyRollup {
        enqueue(subtreeRoot);
    }
}
