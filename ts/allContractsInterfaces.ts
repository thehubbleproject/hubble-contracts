import {
    TokenRegistry,
    Transfer,
    CustomToken,
    DepositManager,
    Rollup,
    BLSAccountRegistry,
    MassMigration,
    Vault,
    WithdrawManager,
    SpokeRegistry,
    FrontendGeneric,
    FrontendTransfer,
    FrontendMassMigration,
    FrontendCreate2Transfer,
    Create2Transfer,
    BurnAuction
} from "../types/ethers-contracts";

export interface allContracts {
    frontendGeneric: FrontendGeneric;
    frontendTransfer: FrontendTransfer;
    frontendMassMigration: FrontendMassMigration;
    frontendCreate2Transfer: FrontendCreate2Transfer;
    blsAccountRegistry: BLSAccountRegistry;
    tokenRegistry: TokenRegistry;
    transfer: Transfer;
    massMigration: MassMigration;
    create2Transfer: Create2Transfer;
    burnAuction: BurnAuction;
    exampleToken: CustomToken;
    spokeRegistry: SpokeRegistry;
    vault: Vault;
    depositManager: DepositManager;
    rollup: Rollup;
    withdrawManager: WithdrawManager;
}
