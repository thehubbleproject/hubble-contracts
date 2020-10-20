import { Signer } from "ethers";
import { DeploymentParameters } from "./interfaces";
import { allContracts } from "./allContractsInterfaces";
export declare function deployAll(signer: Signer, parameters: DeploymentParameters, verbose?: boolean): Promise<allContracts>;
