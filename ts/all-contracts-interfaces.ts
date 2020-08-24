import { ParamManager } from "../types/ethers-contracts/ParamManager";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { NameRegistry } from "../types/ethers-contracts/NameRegistry";
import { Governance } from "../types/ethers-contracts/Governance";
import { MerkleTreeUtils } from "../types/ethers-contracts/MerkleTreeUtils";
import { Logger } from "../types/ethers-contracts/Logger";
import { TokenRegistry } from "../types/ethers-contracts/TokenRegistry";
import { Pob } from "../types/ethers-contracts/Pob";
import { CreateAccountProduction } from "../types/ethers-contracts/CreateAccountProduction";
import { AirdropProduction } from "../types/ethers-contracts/AirdropProduction";
import { TransferProduction } from "../types/ethers-contracts/TransferProduction";
import { BurnConsentProduction } from "../types/ethers-contracts/BurnConsentProduction";
import { BurnExecutionProduction } from "../types/ethers-contracts/BurnExecutionProduction";
import { TestToken } from "../types/ethers-contracts/TestToken";
import { DepositManager } from "../types/ethers-contracts/DepositManager";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { RollupReddit } from "../types/ethers-contracts/RollupReddit";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";

export interface allContracts {
    paramManager: ParamManager;
    rollupUtils: RollupUtils;
    nameRegistry: NameRegistry;
    governance: Governance;
    logger: Logger;
    merkleTreeUtils: MerkleTreeUtils;
    blsAccountRegistry: BlsAccountRegistry;
    tokenRegistry: TokenRegistry;
    createAccount: CreateAccountProduction;
    airdrop: AirdropProduction;
    transfer: TransferProduction;
    burnConsent: BurnConsentProduction;
    burnExecution: BurnExecutionProduction;
    pob: Pob;
    testToken: TestToken;
    depositManager: DepositManager;
    rollupReddit: RollupReddit;
    rollup: Rollup;
}
