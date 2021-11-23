// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { BatchManager } from "../rollup/BatchManager.sol";
import { Types } from "../libs/Types.sol";
import { IDepositManager } from "../DepositManager.sol";
import { Chooser } from "../proposers/Chooser.sol";

contract MockDepositManager is IDepositManager {
    // paramMaxSubtreeDepth is required by the interface, no actual use here.
    uint256 public constant override paramMaxSubtreeDepth = 0;

    function dequeueToSubmit()
        external
        override
        returns (uint256 subtreeID, bytes32 subtreeRoot)
    {
        return (0, bytes32(0));
    }

    function reenqueue(bytes32 subtreeRoot) external override {}
}

contract TestRollup is BatchManager {
    constructor(
        IDepositManager _depositManager,
        uint256 stakeAmount,
        uint256 blocksToFinalise,
        uint256 minGasLeft
    )
        public
        BatchManager(
            stakeAmount,
            blocksToFinalise,
            minGasLeft,
            Chooser(address(0)),
            _depositManager
        )
    {}

    function submitDummyBatch() external payable {
        submitBatch(bytes32(0), 0, bytes32(0), Types.Usage.Transfer);
    }

    function submitDeposits(bytes32 depositSubTreeRoot) external payable {
        deposits[nextBatchID] = depositSubTreeRoot;
        submitBatch(bytes32(0), 0, bytes32(0), Types.Usage.Transfer);
    }

    function testRollback(uint256 batchID) external returns (uint256) {
        uint256 g = gasleft();
        startRollingBack(batchID, Types.Result.BadSignature);
        return g - gasleft();
    }
}
