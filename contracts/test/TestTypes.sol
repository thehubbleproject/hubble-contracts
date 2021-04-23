// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";

contract TestTypes {
    using Types for Types.Batch;

    function encodeMeta(
        uint256 batchType,
        uint256 commitmentLength,
        address committer,
        uint256 finaliseOn
    ) external pure returns (bytes32) {
        return
            Types.encodeMeta(
                batchType,
                commitmentLength,
                committer,
                finaliseOn
            );
    }

    function decodeMeta(bytes32 meta)
        external
        pure
        returns (
            uint256 batchType,
            uint256 size,
            address committer,
            uint256 finaliseOn
        )
    {
        Types.Batch memory batch =
            Types.Batch({ commitmentRoot: bytes32(0), meta: meta });
        batchType = batch.batchType();
        size = batch.size();
        committer = batch.committer();
        finaliseOn = batch.finaliseOn();
    }
}
