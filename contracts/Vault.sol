pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { Rollup } from "./Rollup.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { Types } from "./libs/Types.sol";
import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { SpokeRegistry } from "./SpokeRegistry.sol";

contract Vault {
    Rollup public rollup;
    Registry public nameRegistry;
    MTUtils public merkleUtils;
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
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        spokes = SpokeRegistry(
            nameRegistry.getContractDetails(ParamManager.SPOKE_REGISTRY())
        );
    }

    function requestApproval(
        uint256 batch_id,
        Types.MMCommitmentInclusionProof calldata commitmentMP,
        bytes calldata txs
    ) external {
        // ensure msg.sender is the the target spoke
        require(
            msg.sender ==
                spokes.getSpokeAddress(
                    commitmentMP.commitment.massMigrationMetaInfo.targetSpokeID
                )
        );
        // commitment is a mass migration commitment
        require(commitmentMP.commitment.batchType == Types.Usage.MassMigration);
        {
            // ensure batch is finalised
            require(
                block.number >= rollup.getBatch(batch_id).finalisesOn,
                "Batch not finalised"
            );

            // check if commitment was submitted in the batch
            require(
                merkleUtils.verifyLeaf(
                    rollup.getBatch(batch_id).commitmentRoot,
                    RollupUtils.MMCommitmentToHash(
                        commitmentMP.commitment.stateRoot,
                        commitmentMP.commitment.accountRoot,
                        txs,
                        commitmentMP.commitment.massMigrationMetaInfo.tokenID,
                        commitmentMP.commitment.massMigrationMetaInfo.amount,
                        commitmentMP
                            .commitment
                            .massMigrationMetaInfo
                            .withdrawRoot,
                        commitmentMP
                            .commitment
                            .massMigrationMetaInfo
                            .targetSpokeID,
                        commitmentMP.commitment.signature
                    ),
                    commitmentMP.pathToCommitment,
                    commitmentMP.siblings
                ),
                "Commitment not present in batch"
            );
        }

        IERC20 tokenContract = IERC20(
            tokenRegistry.registeredTokens(
                commitmentMP.commitment.massMigrationMetaInfo.tokenID
            )
        );

        require(
            tokenContract.approve(
                msg.sender,
                commitmentMP.commitment.massMigrationMetaInfo.amount
            ),
            "Token approval failed"
        );
    }
}
