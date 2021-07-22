import { execSync } from "child_process";
import { Signer } from "ethers";
import { allContracts } from "./allContractsInterfaces";
import { DeploymentParameters } from "./interfaces";
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
    CustomToken__factory,
    SpokeRegistry__factory,
    Vault__factory,
    DepositManager__factory,
    Rollup__factory,
    WithdrawManager__factory,
    BurnAuction__factory
} from "../types/ethers-contracts";
import { readJSON, writeJSON } from "./file";

export interface Auxiliary {
    domain: string;
    genesisEth1Block: number;
    version: string;
    chainid: number;
}

export class Genesis {
    constructor(
        public readonly parameters: DeploymentParameters,
        public readonly addresses: Record<string, string>,
        public readonly auxiliary: Auxiliary
    ) {}

    public static async fromConfig(
        path: string = "./genesis.json"
    ): Promise<Genesis> {
        console.info(`loading genesis from ${path}`);
        const { parameters, addresses, auxiliary } = await readJSON(path);
        return new this(parameters, addresses, auxiliary);
    }

    public static async fromContracts(
        contracts: allContracts,
        parameters: DeploymentParameters,
        genesisEth1Block: number,
        chainid: number
    ): Promise<Genesis> {
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
            version,
            chainid
        };
        return new this(parameters, addresses, auxiliary);
    }

    public async dump(path: string): Promise<void> {
        console.info(`writing genesis to ${path}`);
        await writeJSON(path, this);
    }

    public getContracts(signer: Signer): allContracts {
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
            exampleToken: CustomToken__factory,
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

    public toString(): string {
        return JSON.stringify(this, null, 4);
    }
}
