// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { MerkleTree } from "./libs/MerkleTree.sol";
import { BLS } from "./libs/BLS.sol";
import { Bitmap } from "./libs/Bitmap.sol";
import { IEIP712 } from "./libs/EIP712.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { Vault } from "./Vault.sol";

contract WithdrawManager {
    using Tx for bytes;
    using Types for Types.UserState;
    using SafeERC20 for IERC20;

    // withdrawRoot => a bitmap of whether a publicIndex owner has the token claimed
    mapping(bytes32 => mapping(uint256 => uint256)) private bitmap;
    // withdrawRoot => accountRoot
    mapping(bytes32 => bytes32) private processed;

    ITokenRegistry public immutable tokenRegistry;
    Vault public immutable vault;
    IEIP712 public immutable domain;

    constructor(
        ITokenRegistry _tokenRegistry,
        Vault _vault,
        IEIP712 _domain
    ) public {
        tokenRegistry = _tokenRegistry;
        vault = _vault;
        domain = _domain;
    }

    function processWithdrawCommitment(
        uint256 batchID,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        require(
            processed[commitmentMP.commitment.body.withdrawRoot] == "",
            "WithdrawManager: commitment was already processed"
        );
        vault.requestApproval(batchID, commitmentMP);
        (address addr, uint256 l2Unit) =
            tokenRegistry.safeGetRecord(commitmentMP.commitment.body.tokenID);
        processed[commitmentMP.commitment.body.withdrawRoot] = commitmentMP
            .commitment
            .body
            .accountRoot;
        uint256 l1Amount = commitmentMP.commitment.body.amount * l2Unit;
        // transfer tokens from vault
        IERC20(addr).safeTransferFrom(address(vault), address(this), l1Amount);
    }

    function claimTokens(
        bytes32 withdrawRoot,
        Types.StateMerkleProofWithPath calldata withdrawal,
        uint256[4] calldata pubkey,
        uint256[2] calldata signature,
        bytes32[] calldata pubkeyWitness
    ) external {
        bytes32 accountRoot = processed[withdrawRoot];
        require(
            accountRoot != bytes32(0),
            "WithdrawManager: withdrawRoot should have been processed"
        );
        require(
            MerkleTree.verify(
                withdrawRoot,
                keccak256(withdrawal.state.encode()),
                withdrawal.path,
                withdrawal.witness
            ),
            "WithdrawManager: state should be in the withdrawRoot"
        );
        require(
            !Bitmap.isClaimed(withdrawal.state.pubkeyID, bitmap[withdrawRoot]),
            "WithdrawManager: Token has been claimed"
        );
        require(
            MerkleTree.verify(
                accountRoot,
                keccak256(abi.encodePacked(pubkey)),
                withdrawal.state.pubkeyID,
                pubkeyWitness
            ),
            "WithdrawManager: Public key should be in the Registry"
        );

        bool callSuccess;
        bool checkSuccess;
        (checkSuccess, callSuccess) = BLS.verifySingle(
            signature,
            pubkey,
            BLS.hashToPoint(
                domain.domainSeparator(),
                abi.encodePacked(msg.sender)
            )
        );
        require(callSuccess, "WithdrawManager: Precompile call failed");
        require(checkSuccess, "WithdrawManager: Bad signature");
        (address addr, uint256 l2Unit) =
            tokenRegistry.safeGetRecord(withdrawal.state.tokenID);
        Bitmap.setClaimed(withdrawal.state.pubkeyID, bitmap[withdrawRoot]);
        uint256 l1Amount = withdrawal.state.balance * l2Unit;
        // transfer tokens from vault
        IERC20(addr).safeTransfer(msg.sender, l1Amount);
    }
}
