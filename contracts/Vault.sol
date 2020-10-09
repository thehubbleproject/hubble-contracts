pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Rollup } from "./Rollup.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { Types } from "./libs/Types.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { SpokeRegistry } from "./SpokeRegistry.sol";

contract Vault {
    using Types for Types.MassMigrationCommitment;

    Rollup public rollup;
    Registry public nameRegistry;
    SpokeRegistry public spokes;
    ITokenRegistry public tokenRegistry;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        spokes = SpokeRegistry(
            nameRegistry.getContractDetails(ParamManager.SPOKE_REGISTRY())
        );
    }

    /**
    @dev We assume Vault is deployed before Rollup
     */
    function setRollupAddress() external {
        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );
    }

    function requestApproval(
        uint256 batch_id,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        require(
            msg.sender ==
                spokes.getSpokeAddress(
                    commitmentMP.commitment.body.targetSpokeID
                ),
            "Vault: msg.sender should be the target spoke"
        );
        Types.Batch memory batch = rollup.getBatch(batch_id);

        require(
            block.number >= batch.finalisesOn,
            "Vault: Batch shoould be finalised"
        );

        require(
            MerkleTreeUtilsLib.verifyLeaf(
                batch.commitmentRoot,
                commitmentMP.commitment.toHash(),
                commitmentMP.pathToCommitment,
                commitmentMP.witness
            ),
            "Vault: Commitment is not present in batch"
        );

        address tokenContractAddress = tokenRegistry.registeredTokens(
            commitmentMP.commitment.body.tokenID
        );
        require(
            tokenContractAddress != address(0),
            "Vault: Token should be registered"
        );

        IERC20 tokenContract = IERC20(tokenContractAddress);

        require(
            tokenContract.approve(
                msg.sender,
                commitmentMP.commitment.body.amount
            ),
            "Vault: Token approval failed"
        );
    }
}
