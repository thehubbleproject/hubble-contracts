import { allContracts } from "./allContractsInterfaces";
import { DeploymentParameters } from "./interfaces";
import fs from "fs";
import {
    BlsAccountRegistryFactory,
    BurnAuctionFactory,
    Create2TransferFactory,
    DepositManagerFactory,
    ExampleTokenFactory,
    FrontendCreate2TransferFactory,
    FrontendGenericFactory,
    FrontendMassMigrationFactory,
    FrontendTransferFactory,
    MassMigrationFactory,
    NameRegistryFactory,
    ParamManagerFactory,
    ProofOfBurnFactory,
    RollupFactory,
    SpokeRegistryFactory,
    TokenRegistryFactory,
    TransferFactory,
    VaultFactory,
    WithdrawManagerFactory
} from "../types/ethers-contracts";
import { Signer } from "ethers";

function parseGenesis(
    parameters: DeploymentParameters,
    addresses: { [key: string]: string },
    signer: Signer
): allContracts {
    const factories = {
        paramManager: ParamManagerFactory,
        frontendGeneric: FrontendGenericFactory,
        frontendTransfer: FrontendTransferFactory,
        frontendMassMigration: FrontendMassMigrationFactory,
        frontendCreate2Transfer: FrontendCreate2TransferFactory,
        nameRegistry: NameRegistryFactory,
        blsAccountRegistry: BlsAccountRegistryFactory,
        tokenRegistry: TokenRegistryFactory,
        transfer: TransferFactory,
        massMigration: MassMigrationFactory,
        create2Transfer: Create2TransferFactory,
        exampleToken: ExampleTokenFactory,
        spokeRegistry: SpokeRegistryFactory,
        vault: VaultFactory,
        depositManager: DepositManagerFactory,
        rollup: RollupFactory,
        withdrawManager: WithdrawManagerFactory,
        chooser: parameters.USE_BURN_AUCTION
            ? BurnAuctionFactory
            : ProofOfBurnFactory
    };
    const contracts: any = {};
    for (const [key, factory] of Object.entries(factories)) {
        const address = addresses[key];
        if (!address) throw `Bad Genesis: Find no address for ${key} contract`;
        contracts[key] = factory.connect(address, signer);
    }
    return contracts;
}

export class Hubble {
    private constructor(
        public parameters: DeploymentParameters,
        public contracts: allContracts
    ) {}
    static fromGenesis(
        parameters: DeploymentParameters,
        addresses: { [key: string]: string },
        signer: Signer
    ) {
        const contracts = parseGenesis(parameters, addresses, signer);
        return new Hubble(parameters, contracts);
    }

    show() {
        console.log(this.contracts);
    }
}
