// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import { DepositCore } from "../DepositManager.sol";

contract TestDepositCore is DepositCore {
    constructor(uint256 maxSubtreeDepth) public {
        paramMaxSubtreeSize = 1 << maxSubtreeDepth;
    }

    function testInsertAndMerge(bytes32 depositLeaf)
        external
        returns (uint256 gasCost)
    {
        uint256 operationCost = gasleft();
        insertAndMerge(depositLeaf);
        gasCost = operationCost - gasleft();
    }

    function getQueue(uint256 index) public view returns (bytes32) {
        return queue[index];
    }
}
