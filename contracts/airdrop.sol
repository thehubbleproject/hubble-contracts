pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {IERC20} from "./interfaces/IERC20.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";

import {Types} from "./libs/Types.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {ECVerify} from "./libs/ECVerify.sol";

import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";

contract AirdropSetup {
    using SafeMath for uint256;
    using ECVerify for bytes32;

    MTUtils public merkleUtils;

    bytes32
        public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    /********************
     * Error Codes *
     ********************/
    uint256 public constant NO_ERR = 0;
    uint256 public constant ERR_TOKEN_ADDR_INVAILD = 1; // account doesnt hold token type in the tx
    uint256 public constant ERR_TOKEN_AMT_INVAILD = 2; // tx amount is less than zero
    uint256 public constant ERR_TOKEN_NOT_ENOUGH_BAL = 3; // leaf doesnt has enough balance
    uint256 public constant ERR_FROM_TOKEN_TYPE = 4; // from account doesnt hold the token type in the tx
    uint256 public constant ERR_TO_TOKEN_TYPE = 5; // to account doesnt hold the token type in the tx
}

contract AirdropHelpers is AirdropSetup {
    function AddTokensToAccount(
        Types.UserAccount memory account,
        uint256 numOfTokens
    ) public pure returns (Types.UserAccount memory updatedAccount) {
        return (
            RollupUtils.UpdateBalanceInAccount(
                account,
                RollupUtils.BalanceFromAccount(account).add(numOfTokens)
            )
        );
    }
    function UpdateAccountWithSiblings(
        Types.UserAccount memory new_account,
        Types.AccountMerkleProof memory _merkle_proof
    ) public view returns (bytes32, uint256) {
        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            keccak256(RollupUtils.BytesFromAccount(new_account)),
            _merkle_proof.accountIP.pathToAccount,
            _merkle_proof.siblings
        );
        uint256 balance = RollupUtils.BalanceFromAccount(new_account);
        return (newRoot, balance);
    }
}

contract Airdrop is AirdropHelpers {
    function dropHashchains(Types.Transaction[] memory drops)
        public
        pure
        returns (bytes32)
    {
        bytes32 message = ZERO_BYTES32;

        for (uint256 i = 0; i < drops.length; i++) {
            message = keccak256(
                abi.encode(drops[i].toIndex, drops[i].amount, message)
            );
        }
        return message;
    }

    function processDrop(
        Types.Transaction memory drop,
        Types.AccountMerkleProof memory _to_merkle_proof
    )
        public
        view
        returns (
            bytes32,
            uint256,
            bool
        )
    {
        if (drop.amount < 0) {
            // invalid state transition
            // needs to be slashed because the submitted transaction
            // had amount less than 0
            return (ZERO_BYTES32, ERR_TOKEN_AMT_INVAILD, false);
        }

        Types.UserAccount memory new_to_account = AddTokensToAccount(
            _to_merkle_proof.accountIP.account,
            drop.amount
        );

        // account holds the token type in the tx
        if (_to_merkle_proof.accountIP.account.tokenType != drop.tokenType)
            // invalid state transition

            // needs to be slashed because the submitted transaction
            // had invalid token type
            return (ZERO_BYTES32, ERR_FROM_TOKEN_TYPE, false);

        (bytes32 newRoot, uint256 to_new_balance) = UpdateAccountWithSiblings(
            new_to_account,
            _to_merkle_proof
        );

        return (newRoot, to_new_balance, true);
    }
}
