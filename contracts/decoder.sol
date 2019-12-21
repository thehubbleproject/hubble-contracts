pragma solidity ^0.5.0;

import { BytesLib } from "solidity-bytes-utils/contracts/BytesLib.sol";

contract Decoder {
   event newEvent(bytes to, uint256 from) ;
    function decodeTx(bytes memory tx_bytes) public returns(bytes memory,bytes memory){
        bytes memory to_bytes = BytesLib.slice(tx_bytes,0,4);
        bytes memory from_bytes = BytesLib.slice(tx_bytes,4,8);
        uint256 to_bytes32 = toBytes32(to_bytes);
        // require(1 == to_bytes32,"to doesnt match");
        emit newEvent(to_bytes, to_bytes32);
        return (to_bytes,from_bytes);
    }
    function toBytes32(bytes memory b) public pure returns (uint256) {
        bytes32 out;
        for (uint i = 0; i < 32 && i < b.length; i++) {
        out |= bytes32(b[i] & 0xFF) >> (i * 8);
        }
        return uint256(out);
    }
}
