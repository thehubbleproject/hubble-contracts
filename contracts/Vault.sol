pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Bitmap } from "./libs/Bitmap.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Rollup } from "./rollup/Rollup.sol";
import { ITokenRegistry } from "./TokenRegistry.sol";
import { Types } from "./libs/Types.sol";
import { MerkleTree } from "./libs/MerkleTree.sol";
import { SpokeRegistry } from "./SpokeRegistry.sol";

contract Vault {
    using Types for Types.MassMigrationCommitment;
    using Types for Types.Batch;

    Rollup public rollup;
    SpokeRegistry public spokes;
    ITokenRegistry public tokenRegistry;

    mapping(uint256 => uint256) private bitmap;

    constructor(
        ITokenRegistry _tokenRegistry,
        SpokeRegistry _spokes,
        Rollup _rollup
    ) public {
        tokenRegistry = _tokenRegistry;
        spokes = _spokes;
        rollup = _rollup;
    }

    function isBatchApproved(uint256 batchID) public view returns (bool) {
        return Bitmap.isClaimed(batchID, bitmap);
    }

    function requestApproval(
        uint256 batchID,
        Types.MMCommitmentInclusionProof memory commitmentMP
    ) public {
        require(
            msg.sender ==
                spokes.getSpokeAddress(commitmentMP.commitment.body.spokeID),
            "Vault: msg.sender should be the target spoke"
        );
        Types.Batch memory batch = rollup.getBatch(batchID);

        require(
            block.number >= batch.finaliseOn(),
            "Vault: Batch shoould be finalised"
        );

        require(
            MerkleTree.verify(
                batch.commitmentRoot,
                commitmentMP.commitment.toHash(),
                commitmentMP.path,
                commitmentMP.witness
            ),
            "Vault: Commitment is not present in batch"
        );
        IERC20 tokenContract = IERC20(
            tokenRegistry.safeGetAddress(commitmentMP.commitment.body.tokenID)
        );
        Bitmap.setClaimed(batchID, bitmap);
        require(
            tokenContract.approve(
                msg.sender,
                commitmentMP.commitment.body.amount
            ),
            "Vault: Token approval failed"
        );
    }
}
