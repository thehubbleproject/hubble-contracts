pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "./Types.sol";

library FraudProofHelpers {
    using SafeMath for uint256;

    function validateTxBasic(
        uint256 amount,
        uint256 fee,
        Types.UserState memory fromState
    ) internal pure returns (Types.ErrorCode) {
        if (amount == 0) {
            return Types.ErrorCode.InvalidTokenAmount;
        }
        if (fromState.balance < amount.add(fee)) {
            return Types.ErrorCode.NotEnoughTokenBalance;
        }
        return Types.ErrorCode.NoError;
    }
}
