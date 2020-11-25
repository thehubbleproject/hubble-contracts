import { ParamManager } from "../types/ethers-contracts/ParamManager";
import { NameRegistry } from "../types/ethers-contracts/NameRegistry";
import { TokenRegistry } from "../types/ethers-contracts/TokenRegistry";
import { Pob } from "../types/ethers-contracts/Pob";
import { Transfer } from "../types/ethers-contracts/Transfer";
import { TestToken } from "../types/ethers-contracts/TestToken";
import { DepositManager } from "../types/ethers-contracts/DepositManager";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";
import { MassMigration } from "../types/ethers-contracts/MassMigration";
import { Vault } from "../types/ethers-contracts/Vault";
import { WithdrawManager } from "../types/ethers-contracts/WithdrawManager";
import { SpokeRegistry } from "../types/ethers-contracts/SpokeRegistry";
import { FrontendGeneric } from "../types/ethers-contracts/FrontendGeneric";
import { FrontendTransfer } from "../types/ethers-contracts/FrontendTransfer";
import { FrontendMassMigration } from "../types/ethers-contracts/FrontendMassMigration";
import { FrontendCreate2Transfer } from "../types/ethers-contracts/FrontendCreate2Transfer";

export interface allContracts {
    paramManager: ParamManager;
    frontendGeneric: FrontendGeneric;
    frontendTransfer: FrontendTransfer;
    frontendMassMigration: FrontendMassMigration;
    frontendCreate2Transfer: FrontendCreate2Transfer;
    nameRegistry: NameRegistry;
    blsAccountRegistry: BlsAccountRegistry;
    tokenRegistry: TokenRegistry;
    transfer: Transfer;
    massMigration: MassMigration;
    pob: Pob;
    testToken: TestToken;
    spokeRegistry: SpokeRegistry;
    vault: Vault;
    depositManager: DepositManager;
    rollup: Rollup;
    withdrawManager: WithdrawManager;
}
