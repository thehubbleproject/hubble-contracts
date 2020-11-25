pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Types } from "../libs/Types.sol";
import { Parameters } from "./Parameters.sol";
import { Bitmap } from "../libs/Bitmap.sol";
import { IDepositManager } from "../DepositManager.sol";

contract BatchManager is Parameters {
    using SafeMath for uint256;
    using Types for Types.Batch;

    // External contracts
    IDepositManager public depositManager;

    Types.Batch[] public batches;

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
    event BatchRollback(uint256 batchID);
    event RollbackFinalisation(uint256 totalBatchesSlashed);

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
        invalidBatchMarker = invalidBatchID;
        rollback();
    }

    function rollback() internal {
        bytes32 depositSubTreeRoot;
        uint256 totalSlashings = 0;
        for (
            uint256 batchID = batches.length - 1;
            batchID >= invalidBatchMarker;
            batchID--
        ) {
            if (gasleft() <= paramMinGasLeft) break;

            Bitmap.setClaimed(batchID, withdrawalBitmap);
            delete batches[batchID];

            depositSubTreeRoot = deposits[batchID];
            if (depositSubTreeRoot != bytes32(0))
                depositManager.reenqueue(depositSubTreeRoot);

            totalSlashings++;
            batches.length--;

            emit BatchRollback(batchID);
        }
        if (batches.length == invalidBatchMarker) invalidBatchMarker = 0;

        uint256 slashedAmount = totalSlashings.mul(paramStakeAmount);
        uint256 reward = slashedAmount.mul(2).div(3);
        uint256 burn = slashedAmount.sub(reward);
        msg.sender.transfer(reward);
        address(0).transfer(burn);

        emit RollbackFinalisation(totalSlashings);
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
        emit NewBatch(msg.sender, batches.length - 1, batchType);
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
