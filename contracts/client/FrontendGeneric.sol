// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { Types } from "../libs/Types.sol";

contract FrontendGeneric {
    using Types for Types.UserState;

    function encode(Types.UserState calldata state)
        external
        pure
        returns (bytes memory)
    {
        return Types.encode(state);
    }

    function decodeState(bytes calldata stateBytes)
        external
        pure
        returns (Types.UserState memory state)
    {
        return Types.decodeState(stateBytes);
    }
}
