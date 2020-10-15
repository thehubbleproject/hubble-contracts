pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Types } from "./libs/Types.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Tx } from "./libs/Tx.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Vault } from "./Vault.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { BLS } from "./libs/BLS.sol";

contract WithdrawManager {
    using Tx for bytes;
    using Types for Types.UserState;
    Registry public nameRegistry;
    Vault public vault;

    // withdrawRoot => a bitmap of whether a publicIndex owner has the token claimed
    mapping(bytes32 => mapping(uint256 => uint256)) private bitmap;
    // withdrawRoot => accountRoot
    mapping(bytes32 => bytes32) private processed;
    ITokenRegistry public tokenRegistry;
    bytes32 public APP_ID;

    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        vault = Vault(nameRegistry.getContractDetails(ParamManager.VAULT()));
        APP_ID = keccak256(
            abi.encodePacked(
                address(
                    nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
                )
            )
        );
    }

    function isClaimed(bytes32 withdrawRoot, uint256 pubkeyIndex)
        public
        view
        returns (bool)
    {
        uint256 wordIndex = pubkeyIndex / 256;
        uint256 bitIndex = pubkeyIndex % 256;
        uint256 word = bitmap[withdrawRoot][wordIndex];
        uint256 mask = (1 << bitIndex);
        return word & mask == mask;
    }

    function setClaimed(bytes32 withdrawRoot, uint256 pubkeyIndex) private {
        uint256 wordIndex = pubkeyIndex / 256;
        uint256 bitIndex = pubkeyIndex % 256;
        bitmap[withdrawRoot][wordIndex] |= (1 << bitIndex);
    }

    function ProcessWithdrawCommitment(
        uint256 _batch_id,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        vault.requestApproval(_batch_id, commitmentMP);
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

    function ClaimTokens(
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
            MerkleTreeUtilsLib.verifyLeaf(
                withdrawRoot,
                keccak256(withdrawal.state.encode()),
                withdrawal.path,
                withdrawal.witness
            ),
            "WithdrawManager: state should be in the withdrawRoot"
        );
        require(
            !isClaimed(withdrawRoot, withdrawal.state.pubkeyIndex),
            "WithdrawManager: Token has been claimed"
        );
        require(
            MerkleTreeUtilsLib.verifyLeaf(
                accountRoot,
                keccak256(abi.encodePacked(pubkey)),
                withdrawal.state.pubkeyIndex,
                pubkeyWitness
            ),
            "WithdrawManager: Public key should be in the Registry"
        );
        require(
            BLS.verifySingle(
                signature,
                pubkey,
                BLS.hashToPoint(APP_ID, abi.encodePacked(msg.sender))
            ),
            "WithdrawManager: Bad signature"
        );

        IERC20 tokenContract = IERC20(
            tokenRegistry.safeGetAddress(withdrawal.state.tokenType)
        );
        setClaimed(withdrawRoot, withdrawal.state.pubkeyIndex);
        // transfer tokens from vault
        require(
            tokenContract.transfer(msg.sender, withdrawal.state.balance),
            "WithdrawManager: Token transfer failed"
        );
    }
}
