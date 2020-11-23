pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { BatchManager } from "../rollup/BatchManager.sol";
import { Types } from "../libs/Types.sol";
import { Logger } from "../Logger.sol";

contract TestRollup is BatchManager {
    constructor(
        Logger _logger,
        uint256 stakeAmount,
        uint256 blocksToFinalise,
        uint256 minGasLeft
    ) public {
        logger = _logger;
        paramStakeAmount = stakeAmount;
        paramBlocksToFinalise = blocksToFinalise;
        paramMinGasLeft = minGasLeft;
    }

    function submitDummyBatch() external payable {
        submitBatch(bytes32(0), 0, Types.Usage.Transfer);
    }

    function testRollback(uint256 batchID) external returns (uint256) {
        uint256 g = gasleft();
        startRollingBack(batchID);
        return g - gasleft();
    }

    function setMinGasLeft(uint256 minGasLeft) external {
        paramMinGasLeft = minGasLeft;
    }
}
