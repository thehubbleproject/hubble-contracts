import { allContracts } from "./allContractsInterfaces";
import { DeploymentParameters } from "./interfaces";
import fs from "fs";
import { Signer } from "ethers";
import {
    FrontendGenericFactory,
    FrontendTransferFactory,
    FrontendMassMigrationFactory,
    FrontendCreate2TransferFactory,
    BlsAccountRegistryFactory,
    TokenRegistryFactory,
    TransferFactory,
    MassMigrationFactory,
    Create2TransferFactory,
    ExampleTokenFactory,
    SpokeRegistryFactory,
    VaultFactory,
    DepositManagerFactory,
    RollupFactory,
    WithdrawManagerFactory,
    BurnAuctionFactory
} from "../types/ethers-contracts";

export interface Auxiliary {
    domain: string;
    genesisEth1Block: number;
    version: string;
}

export class Genesis {
    constructor(
        public readonly parameters: DeploymentParameters,
        public readonly addresses: { [key: string]: string },
        public readonly auxiliary: Auxiliary
    ) {}

    static fromConfig(path: string) {
        const genesis = fs.readFileSync(path).toString();
        const { parameters, addresses, auxiliary } = JSON.parse(genesis);
        return new this(parameters, addresses, auxiliary);
    }

    dump(path: string) {
        fs.writeFileSync(path, JSON.stringify(this, null, 4));
    }

    getContracts(signer: Signer): allContracts {
        const factories = {
            frontendGeneric: FrontendGenericFactory,
            frontendTransfer: FrontendTransferFactory,
            frontendMassMigration: FrontendMassMigrationFactory,
            frontendCreate2Transfer: FrontendCreate2TransferFactory,
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
            burnAuction: BurnAuctionFactory
        };
        const contracts: any = {};
        for (const [key, factory] of Object.entries(factories)) {
            const address = this.addresses[key];
            if (!address)
                throw `Bad Genesis: Find no address for ${key} contract`;
            contracts[key] = factory.connect(address, signer);
        }
        return contracts;
    }
}
