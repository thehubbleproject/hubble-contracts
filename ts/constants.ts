import { ethers } from "ethers";
import { DeploymentParameters } from "./interfaces";

export const TESTING_PARAMS: DeploymentParameters = {
    MAX_DEPTH: 4,
    MAX_DEPOSIT_SUBTREE_DEPTH: 1,
    STAKE_AMOUNT: "0.1",
    GENESIS_STATE_ROOT: ethers.constants.HashZero
};

// ethers.utils.keccak256(ethers.constants.HashZero)
export const ZERO_BYTES32 =
    "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
