pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;
import "solidity-bytes-utils/contracts/BytesLib.sol";

contract Decode {
    // decodeTx decodes from transaction bytes to struct
    function decodeTx(bytes memory tx_bytes) view public{
        
    }
    
    function sliceUint(bytes memory bs, uint start) internal pure returns (uint){
        require(bs.length >= start + 32, "slicing out of range");
        uint x;
        assembly {
            x := mload(add(bs, add(0x20, start)))
        }
        return x;
    }               
}
