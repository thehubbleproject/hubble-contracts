pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "./Types.sol";

library Transition {
    using SafeMath for uint256;

    function validateTxBasic(
        uint256 amount,
        uint256 fee,
        Types.UserState memory fromState
    ) internal pure returns (Types.Result) {
        if (amount == 0) return Types.Result.InvalidTokenAmount;

        if (fromState.balance < amount.add(fee))
            return Types.Result.NotEnoughTokenBalance;

        return Types.Result.Ok;
    }
}
