pragma solidity ^0.5.15;

contract Bitmap {
    mapping(uint256 => uint256) private bitmap;

    function isClaimed(uint256 index) internal view returns (bool) {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        uint256 word = bitmap[wordIndex];
        uint256 mask = (1 << bitIndex);
        return word & mask == mask;
    }

    function setClaimed(uint256 index) internal {
        uint256 wordIndex = index / 256;
        uint256 bitIndex = index % 256;
        bitmap[wordIndex] |= (1 << bitIndex);
    }
}
