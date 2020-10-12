pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";

contract ClientFrontend {
    using Tx for bytes;
    using Types for Types.UserState;

}
