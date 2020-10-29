pragma solidity ^0.5.15;
import { Bitmap } from "../libs/Bitmap.sol";

contract TestBitmap is Bitmap {
    function testIsClaimed(uint256 index) public view returns (bool) {
        return isClaimed(index);
    }

    function testSetClaimed(uint256 index) public {
        setClaimed(index);
    }
}
