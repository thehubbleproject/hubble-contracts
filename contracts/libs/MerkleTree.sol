// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

/**
    @notice work with sparse Merkle Tree
    @dev we assume the tree is at maximum 32 level depth
*/
library MerkleTree {
    function computeRoot(
        bytes32 leafInput,
        uint256 path,
        bytes32[] memory witness
    ) internal pure returns (bytes32) {
        // Copy to avoid assigning to the function parameter.
        bytes32 leaf = leafInput;
        for (uint256 i = 0; i < witness.length; i++) {
            // get i-th bit from right
            if (((path >> i) & 1) == 0) {
                leaf = keccak256(abi.encode(leaf, witness[i]));
            } else {
                leaf = keccak256(abi.encode(witness[i], leaf));
            }
        }
        return leaf;
    }

    function verify(
        bytes32 root,
        bytes32 leaf,
        uint256 path,
        bytes32[] memory witness
    ) internal pure returns (bool) {
        return computeRoot(leaf, path, witness) == root;
    }

    function getRoot(uint256 level) internal pure returns (bytes32) {
        bytes32[32] memory hashes;
        hashes[0] = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;
        hashes[1] = 0x633dc4d7da7256660a892f8f1604a44b5432649cc8ec5cb3ced4c4e6ac94dd1d;
        hashes[2] = 0x890740a8eb06ce9be422cb8da5cdafc2b58c0a5e24036c578de2a433c828ff7d;
        hashes[3] = 0x3b8ec09e026fdc305365dfc94e189a81b38c7597b3d941c279f042e8206e0bd8;
        hashes[4] = 0xecd50eee38e386bd62be9bedb990706951b65fe053bd9d8a521af753d139e2da;
        hashes[5] = 0xdefff6d330bb5403f63b14f33b578274160de3a50df4efecf0e0db73bcdd3da5;
        hashes[6] = 0x617bdd11f7c0a11f49db22f629387a12da7596f9d1704d7465177c63d88ec7d7;
        hashes[7] = 0x292c23a9aa1d8bea7e2435e555a4a60e379a5a35f3f452bae60121073fb6eead;
        hashes[8] = 0xe1cea92ed99acdcb045a6726b2f87107e8a61620a232cf4d7d5b5766b3952e10;
        hashes[9] = 0x7ad66c0a68c72cb89e4fb4303841966e4062a76ab97451e3b9fb526a5ceb7f82;
        hashes[10] = 0xe026cc5a4aed3c22a58cbd3d2ac754c9352c5436f638042dca99034e83636516;
        hashes[11] = 0x3d04cffd8b46a874edf5cfae63077de85f849a660426697b06a829c70dd1409c;
        hashes[12] = 0xad676aa337a485e4728a0b240d92b3ef7b3c372d06d189322bfd5f61f1e7203e;
        hashes[13] = 0xa2fca4a49658f9fab7aa63289c91b7c7b6c832a6d0e69334ff5b0a3483d09dab;
        hashes[14] = 0x4ebfd9cd7bca2505f7bef59cc1c12ecc708fff26ae4af19abe852afe9e20c862;
        hashes[15] = 0x2def10d13dd169f550f578bda343d9717a138562e0093b380a1120789d53cf10;
        hashes[16] = 0x776a31db34a1a0a7caaf862cffdfff1789297ffadc380bd3d39281d340abd3ad;
        hashes[17] = 0xe2e7610b87a5fdf3a72ebe271287d923ab990eefac64b6e59d79f8b7e08c46e3;
        hashes[18] = 0x504364a5c6858bf98fff714ab5be9de19ed31a976860efbd0e772a2efe23e2e0;
        hashes[19] = 0x4f05f4acb83f5b65168d9fef89d56d4d77b8944015e6b1eed81b0238e2d0dba3;
        hashes[20] = 0x44a6d974c75b07423e1d6d33f481916fdd45830aea11b6347e700cd8b9f0767c;
        hashes[21] = 0xedf260291f734ddac396a956127dde4c34c0cfb8d8052f88ac139658ccf2d507;
        hashes[22] = 0x6075c657a105351e7f0fce53bc320113324a522e8fd52dc878c762551e01a46e;
        hashes[23] = 0x6ca6a3f763a9395f7da16014725ca7ee17e4815c0ff8119bf33f273dee11833b;
        hashes[24] = 0x1c25ef10ffeb3c7d08aa707d17286e0b0d3cbcb50f1bd3b6523b63ba3b52dd0f;
        hashes[25] = 0xfffc43bd08273ccf135fd3cacbeef055418e09eb728d727c4d5d5c556cdea7e3;
        hashes[26] = 0xc5ab8111456b1f28f3c7a0a604b4553ce905cb019c463ee159137af83c350b22;
        hashes[27] = 0x0ff273fcbf4ae0f2bd88d6cf319ff4004f8d7dca70d4ced4e74d2c74139739e6;
        hashes[28] = 0x7fa06ba11241ddd5efdc65d4e39c9f6991b74fd4b81b62230808216c876f827c;
        hashes[29] = 0x7e275adf313a996c7e2950cac67caba02a5ff925ebf9906b58949f3e77aec5b9;
        hashes[30] = 0x8f6162fa308d2b3a15dc33cffac85f13ab349173121645aedf00f471663108be;
        hashes[31] = 0x78ccaaab73373552f207a63599de54d7d8d0c1805f86ce7da15818d09f4cff62;
        return hashes[level];
    }

    function merklize(bytes32[] memory leaves) internal pure returns (bytes32) {
        require(leaves.length <= 32, "MerkleTree: Too many leaves");
        bytes32[6] memory hashes;
        hashes[0] = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;
        hashes[1] = 0x633dc4d7da7256660a892f8f1604a44b5432649cc8ec5cb3ced4c4e6ac94dd1d;
        hashes[2] = 0x890740a8eb06ce9be422cb8da5cdafc2b58c0a5e24036c578de2a433c828ff7d;
        hashes[3] = 0x3b8ec09e026fdc305365dfc94e189a81b38c7597b3d941c279f042e8206e0bd8;
        hashes[4] = 0xecd50eee38e386bd62be9bedb990706951b65fe053bd9d8a521af753d139e2da;
        hashes[5] = 0xdefff6d330bb5403f63b14f33b578274160de3a50df4efecf0e0db73bcdd3da5;
        uint256 odd = leaves.length & 1;
        uint256 n = (leaves.length + 1) >> 1;
        bytes32[] memory nodes = new bytes32[](n);
        // pNodes are nodes in previous level. They are input leaves in level 0, and are `nodes` in other levels.
        // We use pNodes to avoid damaging the input leaves.
        bytes32[] memory pNodes = leaves;
        uint256 level = 0;
        while (true) {
            uint256 i = 0;
            for (; i < n - odd; i++) {
                uint256 j = i << 1;
                nodes[i] = keccak256(abi.encode(pNodes[j], pNodes[j + 1]));
            }
            if (odd == 1) {
                nodes[i] = keccak256(abi.encode(pNodes[i << 1], hashes[level]));
            }
            if (n == 1) {
                break;
            }
            odd = (n & 1);
            n = (n + 1) >> 1;
            level += 1;
            pNodes = nodes;
        }
        return nodes[0];
    }
}
