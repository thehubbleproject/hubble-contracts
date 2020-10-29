pragma solidity ^0.5.15;

library Bitmap {
    function isClaimed(
        uint256 index,
        mapping(uint256 => uint256) storage bitmap
    ) internal view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        uint256 word = bitmap[wordIndex];
        uint256 mask = (1 << bitIndex);
        return word & mask == mask;
    }

    function setClaimed(
        uint256 index,
        mapping(uint256 => uint256) storage bitmap
    ) internal {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        bitmap[wordIndex] |= (1 << bitIndex);
    }
}
