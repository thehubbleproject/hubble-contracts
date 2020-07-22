pragma solidity ^0.5.15;

import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Governance } from "./Governance.sol";
import { Logger } from "./logger.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";

contract IncrementalTree {
    Registry public nameRegistry;
    MTUtils public merkleUtils;
    Governance public governance;
    MerkleTree public tree;
    Logger public logger;
    // Merkle Tree to store the whole tree
    struct MerkleTree {
        // Root of the tree
        bytes32 root;
        // current height of the tree
        uint256 height;
        // Allows you to compute the path to the element (but it's not the path to
        // the elements). Caching these values is essential to efficient appends.
        bytes32[] filledSubtrees;
    }

    // The number of inserted leaves
    uint256 public nextLeafIndex = 0;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        governance = Governance(
            nameRegistry.getContractDetails(ParamManager.Governance())
        );

        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
        tree.filledSubtrees = new bytes32[](governance.MAX_DEPTH());
        setMerkleRootAndHeight(
            merkleUtils.getZeroRoot(),
            merkleUtils.getMaxTreeDepth()
        );
        bytes32 zero = merkleUtils.getDefaultHashAtLevel(0);
        for (uint8 i = 1; i < governance.MAX_DEPTH(); i++) {
            tree.filledSubtrees[i] = zero;
        }
    }

    function appendDataBlock(bytes memory datablock) public returns (uint256) {
        bytes32 _leaf = keccak256(abi.encode(datablock));
        uint256 accID = appendLeaf(_leaf);
        logger.logNewPubkeyAdded(accID, datablock);
        return accID;
    }

    /**
     * @notice Append leaf will append a leaf to the end of the tree
     * @return The sibling nodes along the way.
     */
    function appendLeaf(bytes32 _leaf) public returns (uint256) {
        uint256 currentIndex = nextLeafIndex;
        uint256 depth = uint256(tree.height);
        require(
            currentIndex < uint256(2)**depth,
            "IncrementalMerkleTree: tree is full"
        );
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;
        for (uint8 i = 0; i < tree.height; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = merkleUtils.getRoot(i);
                tree.filledSubtrees[i] = currentLevelHash;
            } else {
                left = tree.filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = merkleUtils.getParent(left, right);
            currentIndex >>= 1;
        }
        tree.root = currentLevelHash;
        uint256 n;
        n = nextLeafIndex;
        nextLeafIndex += 1;
        return n;
    }

    /**
     * @notice Set the tree root and height of the stored tree
     * @param _root The merkle root of the tree
     * @param _height The height of the tree
     */
    function setMerkleRootAndHeight(bytes32 _root, uint256 _height) public {
        tree.root = _root;
        tree.height = _height;
    }

    function getTreeRoot() external view returns (bytes32) {
        return tree.root;
    }
}
