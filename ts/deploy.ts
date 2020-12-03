import { TokenRegistryFactory } from "../types/ethers-contracts/TokenRegistryFactory";
import { TransferFactory } from "../types/ethers-contracts/TransferFactory";
import { MassMigrationFactory } from "../types/ethers-contracts/MassMigrationFactory";
import { ExampleTokenFactory } from "../types/ethers-contracts/ExampleTokenFactory";
import { DepositManagerFactory } from "../types/ethers-contracts/DepositManagerFactory";
import { RollupFactory } from "../types/ethers-contracts/RollupFactory";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { Signer } from "ethers";
import { DeploymentParameters } from "./interfaces";
import { allContracts } from "./allContractsInterfaces";
import {
    FrontendGenericFactory,
    FrontendTransferFactory,
    FrontendMassMigrationFactory,
    FrontendCreate2TransferFactory,
    SpokeRegistryFactory,
    VaultFactory,
    WithdrawManagerFactory,
    Create2TransferFactory
} from "../types/ethers-contracts";
import { BurnAuctionFactory } from "../types/ethers-contracts/BurnAuctionFactory";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";
import { ProofOfBurnFactory } from "../types/ethers-contracts/ProofOfBurnFactory";
import { ProofOfBurn } from "../types/ethers-contracts/ProofOfBurn";
import { GenesisNotSpecified } from "./exceptions";

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters,
    verbose: boolean = false
): Promise<allContracts> {
    // deploy libs
    const frontendGeneric = await new FrontendGenericFactory(signer).deploy();

    const frontendTransfer = await new FrontendTransferFactory(signer).deploy();

    const frontendMassMigration = await new FrontendMassMigrationFactory(
        signer
    ).deploy();

    const frontendCreate2Transfer = await new FrontendCreate2TransferFactory(
        signer
    ).deploy();

    // deploy a chooser
    let chooser: ProofOfBurn | BurnAuction;
    if (parameters.USE_BURN_AUCTION) {
        chooser = await new BurnAuctionFactory(signer).deploy();
    } else {
        chooser = await new ProofOfBurnFactory(signer).deploy();
    }

    const blsAccountRegistry = await new BlsAccountRegistryFactory(
        signer
    ).deploy();
    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistryFactory(signer).deploy();

    const massMigration = await new MassMigrationFactory(signer).deploy();
    const transfer = await new TransferFactory(signer).deploy();

    const create2Transfer = await new Create2TransferFactory(signer).deploy();
    // deploy example token
    const exampleToken = await new ExampleTokenFactory(signer).deploy();
    await tokenRegistry.requestRegistration(exampleToken.address);
    await tokenRegistry.finaliseRegistration(exampleToken.address);

    const spokeRegistry = await new SpokeRegistryFactory(signer).deploy();

    const vault = await new VaultFactory(signer).deploy();
    // deploy deposit manager
    const depositManager = await new DepositManagerFactory(signer).deploy(
        parameters.MAX_DEPOSIT_SUBTREE_DEPTH
    );

    if (!parameters.GENESIS_STATE_ROOT) throw new GenesisNotSpecified();

    // deploy Rollup core
    const rollup = await new RollupFactory(signer).deploy(
        parameters.GENESIS_STATE_ROOT,
        parameters.STAKE_AMOUNT,
        parameters.BLOCKS_TO_FINALISE,
        parameters.MIN_GAS_LEFT,
        parameters.MAX_TXS_PER_COMMIT
    );

    const withdrawManager = await new WithdrawManagerFactory(signer).deploy();
    await spokeRegistry.registerSpoke(withdrawManager.address);

    return {
        frontendGeneric,
        frontendTransfer,
        frontendMassMigration,
        frontendCreate2Transfer,
        blsAccountRegistry,
        tokenRegistry,
        transfer,
        massMigration,
        create2Transfer,
        chooser,
        exampleToken,
        spokeRegistry,
        vault,
        depositManager,
        rollup,
        withdrawManager
    };
}
