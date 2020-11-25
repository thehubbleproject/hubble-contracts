pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { BatchManager } from "../rollup/BatchManager.sol";
import { Types } from "../libs/Types.sol";
import { IDepositManager } from "../DepositManager.sol";

contract MockDepositManager is IDepositManager {
    event EnqueSubtree(bytes32 subtreeRoot);

    function dequeueToSubmit() external returns (bytes32 subtreeRoot) {
        return bytes32(0);
    }

    function reenqueue(bytes32 subtreeRoot) external {
        emit EnqueSubtree(subtreeRoot);
    }
}

contract TestRollup is BatchManager {
    constructor(
        IDepositManager _depositManager,
        uint256 stakeAmount,
        uint256 blocksToFinalise,
        uint256 minGasLeft
    ) public {
        depositManager = _depositManager;
        paramStakeAmount = stakeAmount;
        paramBlocksToFinalise = blocksToFinalise;
        paramMinGasLeft = minGasLeft;
    }

    function submitDummyBatch() external payable {
        submitBatch(bytes32(0), 0, Types.Usage.Transfer);
    }

    function submitDeposits(bytes32 depositSubTreeRoot) external payable {
        deposits[nextBatchID] = depositSubTreeRoot;
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
