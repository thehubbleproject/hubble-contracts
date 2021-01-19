pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "../libs/Types.sol";
import { Parameters } from "./Parameters.sol";
import { Bitmap } from "../libs/Bitmap.sol";
import { IDepositManager } from "../DepositManager.sol";
import { Chooser } from "../proposers/Chooser.sol";

contract BatchManager is Parameters {
    using SafeMath for uint256;
    using Types for Types.Batch;

    // External contracts
    IDepositManager public depositManager;
    Chooser public chooser;

    // batchID -> Batch
    mapping(uint256 => Types.Batch) public batches;
    // nextBatchID also represents how many batches in `batches`
    uint256 public nextBatchID = 0;

    // batchID -> depositSubtreeRoot
    mapping(uint256 => bytes32) public deposits;

    // batchID -> hasWithdrawn
    mapping(uint256 => uint256) public withdrawalBitmap;

    // this variable will be greater than 0 if
    // there is rollback in progress
    // will be reset to 0 once rollback is completed
    uint256 public invalidBatchMarker;

    event NewBatch(address committer, uint256 index, Types.Usage batchType);
    event StakeWithdraw(address committed, uint256 batchID);
    event RollbackComplete(uint256 startID, uint256 nDeleted);
    event RollbackPartiallyComplete(uint256 startID, uint256 nDeleted);

    modifier isNotRollingBack() {
        require(invalidBatchMarker == 0, "BatchManager: Is rolling back");
        _;
    }

    modifier isRollingBack() {
        require(invalidBatchMarker > 0, "BatchManager: Is not rolling back");
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

    function getBatch(uint256 batchID)
        external
        view
        returns (Types.Batch memory batch)
    {
        require(
            batches[batchID].meta != bytes32(0),
            "Batch id greater than total number of batches, invalid batch id"
        );
        batch = batches[batchID];
    }

    function startRollingBack(uint256 invalidBatchID) internal {
        invalidBatchMarker = invalidBatchID;
        rollback();
    }

    function rollback() internal {
        bytes32 depositSubTreeRoot;
        uint256 batchID;
        uint256 nExpect = nextBatchID - invalidBatchMarker;
        uint256 nActual = 0;
        uint256 startID = nextBatchID - 1;
        while (nActual < nExpect) {
            if (gasleft() <= paramMinGasLeft) break;
            batchID = startID - nActual;

            delete batches[batchID];

            depositSubTreeRoot = deposits[batchID];
            if (depositSubTreeRoot != bytes32(0))
                depositManager.reenqueue(depositSubTreeRoot);
            nActual++;
        }
        nextBatchID -= nActual;
        if (nActual == nExpect) {
            invalidBatchMarker = 0;
            emit RollbackComplete(startID, nActual);
        } else {
            emit RollbackPartiallyComplete(startID, nActual);
        }

        uint256 slashedAmount = nActual.mul(paramStakeAmount);
        uint256 reward = slashedAmount.mul(2).div(3);
        uint256 burn = slashedAmount.sub(reward);
        msg.sender.transfer(reward);
        address(0).transfer(burn);
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
        batches[nextBatchID] = Types.Batch({
            commitmentRoot: commitmentRoot,
            meta: Types.encodeMeta(
                uint256(batchType),
                size,
                msg.sender,
                block.number + paramBlocksToFinalise
            )
        });
        emit NewBatch(msg.sender, nextBatchID, batchType);
        nextBatchID++;
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
        emit StakeWithdraw(msg.sender, batchID);
    }
}
