pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Rollup } from "./Rollup.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { Types } from "./libs/Types.sol";
import { MerkleTreeUtilsLib } from "./MerkleTreeUtils.sol";
import { SpokeRegistry } from "./SpokeRegistry.sol";

contract Vault {
    using Types for Types.MassMigrationCommitment;
    using Types for Types.Batch;

    Rollup public rollup;
    Registry public nameRegistry;
    SpokeRegistry public spokes;
    ITokenRegistry public tokenRegistry;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.tokenRegistry())
        );
        spokes = SpokeRegistry(
            nameRegistry.getContractDetails(ParamManager.spokeRegistry())
        );
    }

    /**
    @dev We assume Vault is deployed before Rollup
     */
    function setRollupAddress() external {
        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.rollupCore())
        );
    }

    function requestApproval(
        uint256 batchID,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        require(
            msg.sender ==
                spokes.getSpokeAddress(
                    commitmentMP.commitment.body.targetSpokeID
                ),
            "Vault: msg.sender should be the target spoke"
        );
        Types.Batch memory batch = rollup.getBatch(batchID);

        require(
            block.number >= batch.finaliseOn(),
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
        IERC20 tokenContract = IERC20(
            tokenRegistry.safeGetAddress(commitmentMP.commitment.body.tokenID)
        );
        require(
            tokenContract.approve(
                msg.sender,
                commitmentMP.commitment.body.amount
            ),
            "Vault: Token approval failed"
        );
    }
}
