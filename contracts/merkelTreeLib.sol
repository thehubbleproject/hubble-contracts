
pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract MerkleTree {
    uint8 levels;

    bytes32 public root = 0;
    bytes32[] public filled_subtrees;
    bytes32[] public zeros;

    uint32 public next_index = 0;
    bytes32[160] public defaultHashes;

    
    event LeafAdded(bytes32 leaf);
    event LeafUpdated(bytes32 leaf, uint32 leaf_index);

    constructor() public {
        setDefaultHashes();
        levels = 32;
        bytes32 zero_value=bytes32(0);

        zeros.push(zero_value);
        filled_subtrees.push(zeros[0]);

        for (uint8 i = 1; i < levels; i++) {
            zeros.push(HashLeftRight(zeros[i-1], zeros[i-1]));
            filled_subtrees.push(zeros[i]);
        }

        root = HashLeftRight(zeros[levels - 1], zeros[levels - 1]);
    }
    
    /* Methods */
    /**
     * @notice Set default hashes
     */
    function setDefaultHashes() private {
        // Set the initial default hash
        defaultHashes[0] = keccak256(abi.encodePacked(uint(0)));
        for (uint i = 1; i < defaultHashes.length; i ++) {
            defaultHashes[i] = keccak256(abi.encodePacked(defaultHashes[i-1], defaultHashes[i-1]));
        }
    }


    function HashLeftRight(bytes32 left, bytes32 right) public pure returns (bytes32 keccak_hash) {
       return keccak256(abi.encodePacked(left,right));
    }
    
    
    function insert(bytes32 leaf) public returns(bytes32) {
        // bytes32 leaf = bytes32(leaf_int);
        uint32 leaf_index = next_index;
        uint32 current_index = next_index;
        next_index += 1;

        bytes32 current_level_hash = leaf;
        bytes32 left;
        bytes32 right;

        for (uint8 i = 0; i < levels; i++) {
            if (current_index % 2 == 0) {
                left = current_level_hash;
                right = zeros[i];
                filled_subtrees[i] = current_level_hash;
            } else {
                left = filled_subtrees[i];
                right = current_level_hash;
            }
            current_level_hash = HashLeftRight(left, right);

            current_index /= 2;
        }

        root = current_level_hash;

        emit LeafAdded(leaf);
        return (root);
    }
    
    // function genMerkelRoot(uint256[ ] memory tx_int) public{
    //     bytes32[] memory txs;
    //     for(uint8 k=0;k<tx_int.length;k++){
    //         txs[k]=bytes32(tx_int[k]);
    //     }
    //     uint8 tree_levels = 2;
    //     bytes32 zero_value=0;
    //     uint32 next_leaf_index = 0;

    //     bytes32 tree_root;
    //     bytes32[] memory subtrees;
    //     bytes32[] memory zero_array;
        
    //     zero_array[0]=zero_value;
    //     subtrees[0]=zero_array[0];

    //     for (uint8 i = 1; i < tree_levels; i++) {
    //         zero_array[i] = HashLeftRight(zero_array[i-1], zero_array[i-1]);
    //         subtrees[i]=zero_array[i];
    //     }
    //     tree_root = HashLeftRight(zero_array[tree_levels], zero_array[tree_levels - 1]);
        
    //     for(uint8 i=0;i<txs.length;i++){
    //         bytes32 leaf = txs[i];
    //         uint32 leaf_index = next_leaf_index;
    //         uint32 current_index = next_leaf_index;
    //         next_leaf_index += 1;
    
    //         bytes32 current_level_hash = leaf;
    //         bytes32 left;
    //         bytes32 right;
    
    //         for (uint8 j = 0; j < tree_levels; j++) {
    //             if (current_index % 2 == 0) {
    //                 left = current_level_hash;
    //                 right = zero_array[i];
    //                 subtrees[i] = current_level_hash;
    //             } else {
    //                 left = subtrees[i];
    //                 right = current_level_hash;
    //             }
    //             current_level_hash = HashLeftRight(left, right);
    //             current_index /= 2;
    //         }
    //         tree_root = current_level_hash;
    //     }
    // }

    function getMerkleRoot(bytes[] calldata _dataBlocks) external view returns(bytes32) {
        uint nextLevelLength = _dataBlocks.length;
        uint currentLevel = 0;
        bytes32[] memory nodes = new bytes32[](nextLevelLength + 1); // Add one in case we have an odd number of leaves
        // Generate the leaves
        for (uint i = 0; i < _dataBlocks.length; i++) {
            nodes[i] = keccak256(_dataBlocks[i]);
        }
        if (_dataBlocks.length == 1) {
            return nodes[0];
        }
        // Add a defaultNode if we've got an odd number of leaves
        if (nextLevelLength % 2 == 1) {
            nodes[nextLevelLength] = defaultHashes[currentLevel];
            nextLevelLength += 1;
        }

        // Now generate each level
        while (nextLevelLength > 1) {
            currentLevel += 1;
            // Calculate the nodes for the currentLevel
            for (uint i = 0; i < nextLevelLength / 2; i++) {
                nodes[i] = HashLeftRight(nodes[i*2], nodes[i*2 + 1]);
            }
            nextLevelLength = nextLevelLength / 2;
            // Check if we will need to add an extra node
            if (nextLevelLength % 2 == 1 && nextLevelLength != 1) {
                nodes[nextLevelLength] = defaultHashes[currentLevel];
                nextLevelLength += 1;
            }
        }

        // Alright! We should be left with a single node! Return it...
        return nodes[0];
    }

}