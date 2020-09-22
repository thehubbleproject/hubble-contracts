pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Tx } from "./libs/Tx.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

import { Types } from "./libs/Types.sol";
import { ParamManager } from "./libs/ParamManager.sol";

import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";

contract FraudProofSetup {
    using SafeMath for uint256;
    using Tx for bytes;
    Registry public nameRegistry;

    bytes32
        public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;
}

contract FraudProofHelpers is FraudProofSetup {
    function validateTxBasic(
        uint256 amount,
        uint256 fee,
        Types.UserState memory fromState
    ) public pure returns (Types.ErrorCode) {
        if (amount == 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had 0 amount.
            return Types.ErrorCode.InvalidTokenAmount;
        }

        // check from leaf has enough balance
        if (fromState.balance < amount.add(fee)) {
            // invalid state transition
            // needs to be slashed because the account doesnt have enough balance
            // for the transfer
            return Types.ErrorCode.NotEnoughTokenBalance;
        }

        return Types.ErrorCode.NoError;
    }
}
