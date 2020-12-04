import { TokenRegistryFactory } from "../types/ethers-contracts/TokenRegistryFactory";
import { TransferFactory } from "../types/ethers-contracts/TransferFactory";
import { MassMigrationFactory } from "../types/ethers-contracts/MassMigrationFactory";
import { ExampleTokenFactory } from "../types/ethers-contracts/ExampleTokenFactory";
import { DepositManagerFactory } from "../types/ethers-contracts/DepositManagerFactory";
import { RollupFactory } from "../types/ethers-contracts/RollupFactory";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { providers, Signer } from "ethers";
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
    Create2TransferFactory,
    DeployerFactory
} from "../types/ethers-contracts";
import { BurnAuctionFactory } from "../types/ethers-contracts/BurnAuctionFactory";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";
import { ProofOfBurnFactory } from "../types/ethers-contracts/ProofOfBurnFactory";
import { ProofOfBurn } from "../types/ethers-contracts/ProofOfBurn";
import { GenesisNotSpecified } from "./exceptions";
import { getCreate2Address, id, keccak256 } from "ethers/lib/utils";
import { Deployer } from "../types/ethers-contracts/Deployer";

class Create2Deployer {
    public signer: Signer;
    constructor(public deployerContract: Deployer) {
        this.signer = this.deployerContract.signer;
    }
    public async deploy(
        request: providers.TransactionRequest
    ): Promise<string> {
        const signerAddress = await this.signer.getAddress();
        const salt = id(signerAddress);
        const data = request.data as string;
        const tx = await this.deployerContract.deploy(salt, data);
        await tx.wait();
        const create2Address = getCreate2Address(
            this.deployerContract.address,
            salt,
            keccak256(data)
        );
        return create2Address;
    }
}

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters,
    verbose: boolean = false
): Promise<allContracts> {
    const deployerContract = await new DeployerFactory(signer).deploy();
    const deployer = new Create2Deployer(deployerContract);

    const FG__factory = new FrontendGenericFactory(signer);
    const frontendGeneric = FG__factory.attach(
        await deployer.deploy(FG__factory.getDeployTransaction())
    );

    const FT__factory = new FrontendTransferFactory(signer);
    const frontendTransfer = FT__factory.attach(
        await deployer.deploy(FT__factory.getDeployTransaction())
    );

    const FMM__factory = new FrontendMassMigrationFactory(signer);
    const frontendMassMigration = FMM__factory.attach(
        await deployer.deploy(FMM__factory.getDeployTransaction())
    );

    const FC2T__factory = new FrontendCreate2TransferFactory(signer);
    const frontendCreate2Transfer = FC2T__factory.attach(
        await deployer.deploy(FC2T__factory.getDeployTransaction())
    );

    // deploy a chooser
    let chooser: ProofOfBurn | BurnAuction;
    if (parameters.USE_BURN_AUCTION) {
        const BA__factory = new BurnAuctionFactory(signer);
        chooser = BA__factory.attach(
            await deployer.deploy(BA__factory.getDeployTransaction())
        );
    } else {
        const POB__factory = new ProofOfBurnFactory(signer);
        chooser = POB__factory.attach(
            await deployer.deploy(POB__factory.getDeployTransaction())
        );
    }

    const BLSAR__factory = new BlsAccountRegistryFactory(signer);
    const blsAccountRegistry = BLSAR__factory.attach(
        await deployer.deploy(BLSAR__factory.getDeployTransaction())
    );

    const TR__factory = new TokenRegistryFactory(signer);
    const tokenRegistry = TR__factory.attach(
        await deployer.deploy(TR__factory.getDeployTransaction())
    );

    const MM__factory = new MassMigrationFactory(signer);
    const massMigration = MM__factory.attach(
        await deployer.deploy(MM__factory.getDeployTransaction())
    );

    const Transfer__factory = new TransferFactory(signer);
    const transfer = Transfer__factory.attach(
        await deployer.deploy(Transfer__factory.getDeployTransaction())
    );

    const C2T__factory = new Create2TransferFactory(signer);
    const create2Transfer = C2T__factory.attach(
        await deployer.deploy(C2T__factory.getDeployTransaction())
    );

    const ExampleToken__factory = new ExampleTokenFactory(signer);
    const exampleToken = ExampleToken__factory.attach(
        await deployer.deploy(ExampleToken__factory.getDeployTransaction())
    );

    await tokenRegistry.requestRegistration(exampleToken.address);
    await tokenRegistry.finaliseRegistration(exampleToken.address);

    const SR__factory = new SpokeRegistryFactory(signer);
    const spokeRegistry = SR__factory.attach(
        await deployer.deploy(SR__factory.getDeployTransaction())
    );

    const Vault__factory = new VaultFactory(signer);
    const vault = Vault__factory.attach(
        await deployer.deploy(Vault__factory.getDeployTransaction())
    );

    const DM__factory = new DepositManagerFactory(signer);
    const depositManager = DM__factory.attach(
        await deployer.deploy(
            DM__factory.getDeployTransaction(
                tokenRegistry.address,
                vault.address,
                rollup.address,
                parameters.MAX_DEPOSIT_SUBTREE_DEPTH
            )
        )
    );

    if (!parameters.GENESIS_STATE_ROOT) throw new GenesisNotSpecified();

    // deploy Rollup core
    const rollup = await new RollupFactory(signer).deploy(
        chooser.address,
        depositManager.address,
        blsAccountRegistry.address,
        transfer.address,
        massMigration.address,
        create2Transfer.address,
        parameters.GENESIS_STATE_ROOT,
        parameters.STAKE_AMOUNT,
        parameters.BLOCKS_TO_FINALISE,
        parameters.MIN_GAS_LEFT,
        parameters.MAX_TXS_PER_COMMIT
    );

    const WM__factory = await new WithdrawManagerFactory(signer);
    const withdrawManager = WM__factory.attach(
        await deployer.deploy(WM__factory.getDeployTransaction())
    );
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
