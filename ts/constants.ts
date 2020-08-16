import { DeploymentParameters } from "./interfaces";
import { ethers } from "ethers";

export const TESTING_PARAMS: DeploymentParameters = {
    MAX_DEPTH: 4,
    MAX_DEPOSIT_SUBTREE_DEPTH: 1,
    STAKE_AMOUNT: ethers.utils.parseEther("0.1").toString()
};
