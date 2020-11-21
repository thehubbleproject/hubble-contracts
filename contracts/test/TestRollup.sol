pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Rollup } from "../rollup/Rollup.sol";
import { Types } from "../libs/Types.sol";

contract TestRollup is Rollup {
    function submitDummyBatch() external payable {
        submitBatch(bytes32(0), 0, Types.Usage.Transfer);
    }

    function testRollback(uint256 batchID) external {
        startRollingBack(batchID);
    }
}
