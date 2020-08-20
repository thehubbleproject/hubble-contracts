import { ParamManager } from "../types/ethers-contracts/ParamManager";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { NameRegistry } from "../types/ethers-contracts/NameRegistry";
import { Governance } from "../types/ethers-contracts/Governance";
import { MerkleTreeUtils } from "../types/ethers-contracts/MerkleTreeUtils";
import { Logger } from "../types/ethers-contracts/Logger";
import { TokenRegistry } from "../types/ethers-contracts/TokenRegistry";
import { Pob } from "../types/ethers-contracts/Pob";
import { CreateAccount } from "../types/ethers-contracts/CreateAccount";
import { Airdrop } from "../types/ethers-contracts/Airdrop";
import { Transfer } from "../types/ethers-contracts/Transfer";
import { BurnConsent } from "../types/ethers-contracts/BurnConsent";
import { BurnExecution } from "../types/ethers-contracts/BurnExecution";
import { TestToken } from "../types/ethers-contracts/TestToken";
import { DepositManager } from "../types/ethers-contracts/DepositManager";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { RollupReddit } from "../types/ethers-contracts/RollupReddit";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";



export interface allContracts {
    paramManager: ParamManager,
    rollupUtils: RollupUtils,
    nameRegistry: NameRegistry,
    governance: Governance,
    logger: Logger,
    merkleTreeUtils: MerkleTreeUtils,
    blsAccountRegistry: BlsAccountRegistry,
    tokenRegistry: TokenRegistry,
    createAccount: CreateAccount,
    airdrop: Airdrop,
    transfer: Transfer,
    burnConsent: BurnConsent,
    burnExecution: BurnExecution,
    pob: Pob,
    testToken: TestToken,
    depositManager: DepositManager,
    rollupReddit: RollupReddit,
    rollup: Rollup
}