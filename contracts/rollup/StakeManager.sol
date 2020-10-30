pragma solidity ^0.5.15;
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

contract StakeManager {
    using SafeMath for uint256;

    mapping(uint256 => uint256) private stakes;

    function stake(uint256 batchID, uint256 stakeAmount) internal {
        require(
            msg.value == stakeAmount,
            "StakeManager: not enough stake committed"
        );
        stakes[batchID] = stakeAmount;
    }

    function rewardAndBurn(
        address payable challenger,
        uint256 initialBatchID,
        uint256 totalSlashings
    ) internal {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < totalSlashings; i++) {
            uint256 batchID = initialBatchID - i;
            totalAmount += stakes[batchID];
            delete stakes[batchID];
        }
        uint256 reward = totalAmount.mul(2).div(3);
        uint256 burn = totalAmount.sub(reward);

        challenger.transfer(reward);
        address(0).transfer(burn);
    }

    function withdraw(address payable staker, uint256 batchID) internal {
        require(
            stakes[batchID] != 0,
            "StakeManager: Stake is not withdrawable"
        );
        uint256 amount = stakes[batchID];
        delete stakes[batchID];
        staker.transfer(amount);
    }
}
