pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;
import { Types } from "./libs/Types.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Tx } from "./libs/Tx.sol";
import { Vault } from "./Vault.sol";
import { MerkleTree } from "./libs/MerkleTree.sol";
import { BLS } from "./libs/BLS.sol";
import { Bitmap } from "./libs/Bitmap.sol";

contract WithdrawManager {
    using Tx for bytes;
    using Types for Types.UserState;
    Vault public vault;

    // withdrawRoot => a bitmap of whether a publicIndex owner has the token claimed
    mapping(bytes32 => mapping(uint256 => uint256)) private bitmap;
    // withdrawRoot => accountRoot
    mapping(bytes32 => bytes32) private processed;
    ITokenRegistry public tokenRegistry;
    bytes32 public appID;

    constructor(
        ITokenRegistry _tokenRegistry,
        Vault _vault,
        address _rollup
    ) public {
        tokenRegistry = _tokenRegistry;
        vault = _vault;
        appID = keccak256(abi.encodePacked(_rollup));
    }

    function processWithdrawCommitment(
        uint256 batchID,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        vault.requestApproval(batchID, commitmentMP);
        IERC20 tokenContract = IERC20(
            tokenRegistry.safeGetAddress(commitmentMP.commitment.body.tokenID)
        );
        processed[commitmentMP.commitment.body.withdrawRoot] = commitmentMP
            .commitment
            .body
            .accountRoot;
        // transfer tokens from vault
        require(
            tokenContract.transferFrom(
                address(vault),
                address(this),
                commitmentMP.commitment.body.amount
            ),
            "WithdrawManager: Token transfer failed"
        );
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
            BLS.hashToPoint(appID, abi.encodePacked(msg.sender))
        );
        require(callSuccess, "WithdrawManager: Precompile call failed");
        require(checkSuccess, "WithdrawManager: Bad signature");

        IERC20 tokenContract = IERC20(
            tokenRegistry.safeGetAddress(withdrawal.state.tokenID)
        );
        Bitmap.setClaimed(withdrawal.state.pubkeyID, bitmap[withdrawRoot]);
        // transfer tokens from vault
        require(
            tokenContract.transfer(msg.sender, withdrawal.state.balance),
            "WithdrawManager: Token transfer failed"
        );
    }
}
