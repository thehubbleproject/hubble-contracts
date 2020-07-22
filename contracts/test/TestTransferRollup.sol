pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {Transfer} from "../Transfer.sol";
import {RollupUtils} from "../libs/RollupUtils.sol";
import {Types} from "../libs/Types.sol";
import {BLSAccountRegistry} from "../BLSAccountRegistry.sol";
import {MerkleTreeUtils} from "../MerkleTreeUtils.sol";

contract TestTransferRollup is Transfer {
    constructor(
        BLSAccountRegistry _accountRegistry,
        MerkleTreeUtils _merkleTreeUtils
    ) public {
        accountRegistry = _accountRegistry;
        merkleUtils = _merkleTreeUtils;
    }

    function accountToLeaf(Types.UserAccount calldata account)
        external
        pure
        returns (bytes32)
    {
        return keccak256(RollupUtils.BytesFromAccount(account));
    }
}
