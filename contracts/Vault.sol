pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { Rollup } from "./Rollup.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
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
        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        spokes = SpokeRegistry(
            nameRegistry.getContractDetails(ParamManager.SPOKE_REGISTRY())
        );
    }

    function requestApproval(
        uint256 batch_id,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        // ensure msg.sender is the the target spoke
        require(
            msg.sender ==
                spokes.getSpokeAddress(
                    commitmentMP.commitment.body.targetSpokeID
                )
        );
        {
            // ensure batch is finalised
            require(
                block.number >= rollup.getBatch(batch_id).finalisesOn,
                "Batch not finalised"
            );

            // check if commitment was submitted in the batch
            require(
                MerkleTreeUtilsLib.verifyLeaf(
                    rollup.getBatch(batch_id).commitmentRoot,
                    commitmentMP.commitment.toHash(),
                    commitmentMP.pathToCommitment,
                    commitmentMP.siblings
                ),
                "Commitment not present in batch"
            );
        }

        IERC20 tokenContract = IERC20(
            tokenRegistry.registeredTokens(commitmentMP.commitment.body.tokenID)
        );

        require(
            tokenContract.approve(
                msg.sender,
                commitmentMP.commitment.body.amount
            ),
            "Token approval failed"
        );
    }
}
