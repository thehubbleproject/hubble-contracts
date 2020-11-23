pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "../libs/Types.sol";
import { Logger } from "../Logger.sol";
import { Parameters } from "./Parameters.sol";
import { Bitmap } from "../libs/Bitmap.sol";

contract BatchManager is Parameters {
    using SafeMath for uint256;
    using Types for Types.Batch;

    Logger public logger;

    Types.Batch[] public batches;

    // batchID -> hasWithdrawn
    mapping(uint256 => uint256) public withdrawalBitmap;

    // this variable will be greater than 0 if
    // there is rollback in progress
    // will be reset to 0 once rollback is completed
    uint256 public invalidBatchMarker;

    modifier isNotRollingBack() {
        require(invalidBatchMarker == 0);
        _;
    }

    modifier isRollingBack() {
        require(invalidBatchMarker > 0);
        _;
    }
    modifier isDisputable(uint256 batchID) {
        require(
            block.number < batches[batchID].finaliseOn(),
            "Batch already finalised"
        );

        require(
            batchID < invalidBatchMarker || invalidBatchMarker == 0,
            "Already successfully disputed. Roll back in process"
        );
        _;
    }

    function numOfBatchesSubmitted() public view returns (uint256) {
        return batches.length;
    }

    function getBatch(uint256 batchID)
        external
        view
        returns (Types.Batch memory batch)
    {
        require(
            batches.length - 1 >= batchID,
            "Batch id greater than total number of batches, invalid batch id"
        );
        batch = batches[batchID];
    }

    function startRollingBack(uint256 invalidBatchID) internal {
        require(
            invalidBatchMarker == 0 || invalidBatchID < invalidBatchMarker,
            "Rollup: Not a better rollback"
        );
        invalidBatchMarker = invalidBatchID;
        rollback();
    }

    function rollback() internal {
        uint256 totalSlashings = 0;
        uint256 batchID = batches.length - 1;
        for (; batchID >= invalidBatchMarker; batchID--) {
            if (gasleft() <= paramMinGasLeft) break;

            Bitmap.setClaimed(batchID, withdrawalBitmap);
            delete batches[batchID];

            // TODO: queue deposits again
            // depositManager.tryReenqueue(batchID);

            totalSlashings++;

            logger.logBatchRollback(batchID);
        }
        if (batchID == invalidBatchMarker) invalidBatchMarker = 0;

        uint256 slashedAmount = totalSlashings.mul(paramStakeAmount);
        uint256 reward = slashedAmount.mul(2).div(3);
        uint256 burn = slashedAmount.sub(reward);
        msg.sender.transfer(reward);
        address(0).transfer(burn);
        // resize batches length
        batches.length = batches.length.sub(totalSlashings);

        logger.logRollbackFinalisation(totalSlashings);
    }

    function keepRollingBack() external isRollingBack {
        rollback();
    }

    function submitBatch(
        bytes32 commitmentRoot,
        uint256 size,
        Types.Usage batchType
    ) internal {
        require(msg.value >= paramStakeAmount, "Rollup: wrong stake amount");
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(batchType),
                size,
                msg.sender,
                block.number + paramBlocksToFinalise
            )
        });
        batches.push(newBatch);
        logger.logNewBatch(msg.sender, batches.length - 1, batchType);
    }

    /**
     * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
     */
    function withdrawStake(uint256 batchID) public {
        require(
            msg.sender == batches[batchID].committer(),
            "You are not the correct committer for this batch"
        );
        require(
            block.number > batches[batchID].finaliseOn(),
            "This batch is not yet finalised, check back soon!"
        );
        require(
            !Bitmap.isClaimed(batchID, withdrawalBitmap),
            "Rollup: Already withdrawn"
        );
        Bitmap.setClaimed(batchID, withdrawalBitmap);

        msg.sender.transfer(paramStakeAmount);
        logger.logStakeWithdraw(msg.sender, batchID);
    }
}
