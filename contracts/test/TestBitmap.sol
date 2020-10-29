pragma solidity ^0.5.15;
import { Bitmap } from "../libs/Bitmap.sol";

contract TestBitmap {
    mapping(uint256 => uint256) private bitmap;

    function testIsClaimed(uint256 index) public view returns (bool) {
        return Bitmap.isClaimed(index, bitmap);
    }

    function testSetClaimed(uint256 index) public {
        Bitmap.setClaimed(index, bitmap);
    }
}
