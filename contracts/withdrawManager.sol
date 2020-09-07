pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ParamManager } from "./libs/ParamManager.sol";

import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { POB } from "./POB.sol";
import { Governance } from "./Governance.sol";
import { Rollup } from "./rollup.sol";
import {SpokeRegistry} from "./SpokeRegistry.sol";
contract WithdrawManager {
    MTUtils public merkleUtils;
    Registry public nameRegistry;
    Rollup public rollup;
    SpokeRegistry public spokes;

    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );

        spokes = SpokeRegistry(
            nameRegistry.getContractDetails(ParamManager.SPOKE_REGISTRY())
        );
    }

    function ProcessWithdraw(
        uint256 _batch_id,
        Types.MMCommitmentInclusionProof calldata commitmentMP,
        bytes calldata txs,
        uint256 withdrawTxIndex
    ) external {
        Types.Batch memory withdrawBatch = rollup.getBatch(_batch_id);
        require(
            block.number > withdrawBatch.finalisesOn,
            "Batch not finalised"
        );

        // commitment is a mass migration commitment
        require(commitmentMP.commitment.batchType == Types.Usage.MassMigration);
        // we are the target spoke
        require(address(this) == spokes.getSpokeAddress(commitmentMP.commitment.massMigrationMetaInfo.targetSpokeID));

        // check if commitment was submitted in the batch
        require(
            merkleUtils.verifyLeaf(
                withdrawBatch.commitmentRoot,
                RollupUtils.MMCommitmentToHash(
                    commitmentMP.commitment.stateRoot,
                    commitmentMP.commitment.accountRoot,
                    commitmentMP.commitment.txHashCommitment,
                    commitmentMP.commitment.massMigrationMetaInfo.tokenID,
                    commitmentMP.commitment.massMigrationMetaInfo.amount,
                    commitmentMP.commitment.massMigrationMetaInfo.withdrawRoot,
                    commitmentMP.commitment.massMigrationMetaInfo.targetSpokeID,
                    commitmentMP.commitment.signature
                ),
                commitmentMP.pathToCommitment,
                commitmentMP.siblings
            ),
            "Commitment not present in batch"
        );

        // pull all tokens
    }
}
