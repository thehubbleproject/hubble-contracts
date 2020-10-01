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

        IERC20 tokenContract = IERC20(
            tokenRegistry.registeredTokens(commitmentMP.commitment.body.tokenID)
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
