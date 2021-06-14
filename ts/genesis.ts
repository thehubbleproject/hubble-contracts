import { allContracts } from "./allContractsInterfaces";
import { DeploymentParameters } from "./interfaces";
import fs from "fs";
import { Signer } from "ethers";
import {
    FrontendGeneric__factory,
    FrontendTransfer__factory,
    FrontendMassMigration__factory,
    FrontendCreate2Transfer__factory,
    BLSAccountRegistry__factory,
    TokenRegistry__factory,
    Transfer__factory,
    MassMigration__factory,
    Create2Transfer__factory,
    ExampleToken__factory,
    SpokeRegistry__factory,
    Vault__factory,
    DepositManager__factory,
    Rollup__factory,
    WithdrawManager__factory,
    BurnAuction__factory
} from "../types/ethers-contracts";
import { execSync } from "child_process";

export interface Auxiliary {
    domain: string;
    genesisEth1Block: number;
    version: string;
}

export class Genesis {
    constructor(
        public readonly parameters: DeploymentParameters,
        public readonly addresses: Record<string, string>,
        public readonly auxiliary: Auxiliary
    ) {}

    static fromConfig(path: string) {
        const genesis = fs.readFileSync(path).toString();
        const { parameters, addresses, auxiliary } = JSON.parse(genesis);
        return new this(parameters, addresses, auxiliary);
    }

    static async fromContracts(
        contracts: allContracts,
        parameters: DeploymentParameters,
        genesisEth1Block: number
    ) {
        const addresses = Object.entries(contracts).reduce(
            (prev, [contractName, contract]) => ({
                ...prev,
                [contractName]: contract.address
            }),
            {}
        );

        const domainSeparator = await contracts.rollup.domainSeparator();
        const version = execSync("git rev-parse HEAD")
            .toString()
            .trim();
        const auxiliary = {
            domain: domainSeparator,
            genesisEth1Block,
            version
        };
        return new this(parameters, addresses, auxiliary);
    }

    dump(path: string) {
        fs.writeFileSync(path, JSON.stringify(this, null, 4));
    }

    getContracts(signer: Signer): allContracts {
        const factories = {
            frontendGeneric: FrontendGeneric__factory,
            frontendTransfer: FrontendTransfer__factory,
            frontendMassMigration: FrontendMassMigration__factory,
            frontendCreate2Transfer: FrontendCreate2Transfer__factory,
            blsAccountRegistry: BLSAccountRegistry__factory,
            tokenRegistry: TokenRegistry__factory,
            transfer: Transfer__factory,
            massMigration: MassMigration__factory,
            create2Transfer: Create2Transfer__factory,
            exampleToken: ExampleToken__factory,
            spokeRegistry: SpokeRegistry__factory,
            vault: Vault__factory,
            depositManager: DepositManager__factory,
            rollup: Rollup__factory,
            withdrawManager: WithdrawManager__factory,
            burnAuction: BurnAuction__factory
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
