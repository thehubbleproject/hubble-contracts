import {
    TokenRegistry__factory,
    Transfer__factory,
    MassMigration__factory,
    CustomToken__factory,
    DepositManager__factory,
    Rollup__factory,
    BLSAccountRegistry__factory,
    FrontendGeneric__factory,
    FrontendTransfer__factory,
    FrontendMassMigration__factory,
    FrontendCreate2Transfer__factory,
    SpokeRegistry__factory,
    Vault__factory,
    WithdrawManager__factory,
    Create2Transfer__factory,
    BurnAuction__factory,
    ProofOfBurn__factory
} from "../types/ethers-contracts";

import { Signer, Contract, ContractTransaction } from "ethers";
import { DeploymentParameters } from "./interfaces";
import { allContracts } from "./allContractsInterfaces";
import { GenesisNotSpecified } from "./exceptions";
import { deployKeyless } from "./deployment/deploy";
import { Genesis } from "./genesis";

async function waitAndRegister(
    contract: Contract,
    name: string,
    verbose: boolean
) {
    await contract.deployed();
    if (verbose) console.log("Deployed", name, "at", contract.address);
}

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters,
    verbose: boolean = false
): Promise<allContracts> {
    // deploy libs
    const frontendGeneric = await new FrontendGeneric__factory(signer).deploy();
    await waitAndRegister(frontendGeneric, "frontendGeneric", verbose);

    const frontendTransfer = await new FrontendTransfer__factory(
        signer
    ).deploy();
    await waitAndRegister(frontendTransfer, "frontendTransfer", verbose);

    const frontendMassMigration = await new FrontendMassMigration__factory(
        signer
    ).deploy();
    await waitAndRegister(
        frontendMassMigration,
        "frontendMassMigration",
        verbose
    );

    const frontendCreate2Transfer = await new FrontendCreate2Transfer__factory(
        signer
    ).deploy();
    await waitAndRegister(
        frontendCreate2Transfer,
        "frontendCreate2Transfer",
        verbose
    );
    const burnAuction = await new BurnAuction__factory(signer).deploy(
        parameters.DONATION_ADDRESS,
        parameters.DONATION_NUMERATOR
    );
    await waitAndRegister(burnAuction, "burnAuction", verbose);
    let chooserAddress = burnAuction.address;

    if (!parameters.USE_BURN_AUCTION) {
        const proofOfBurn = await new ProofOfBurn__factory(signer).deploy();
        chooserAddress = proofOfBurn.address;
    }

    const blsAccountRegistry = await new BLSAccountRegistry__factory(
        signer
    ).deploy();
    await waitAndRegister(blsAccountRegistry, "blsAccountRegistry", verbose);

    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistry__factory(signer).deploy();
    await waitAndRegister(tokenRegistry, "tokenRegistry", verbose);

    const massMigration = await new MassMigration__factory(signer).deploy();
    await waitAndRegister(massMigration, "mass_migs", verbose);

    const transfer = await new Transfer__factory(signer).deploy();
    await waitAndRegister(transfer, "transfer", verbose);

    const create2Transfer = await new Create2Transfer__factory(signer).deploy();
    await waitAndRegister(create2Transfer, "create2transfer", verbose);

    // deploy example token
    const exampleToken = await new CustomToken__factory(signer).deploy(
        "Example",
        "EMP"
    );
    await waitAndRegister(exampleToken, "exampleToken", verbose);
    await waitUntilMined(tokenRegistry.registerToken(exampleToken.address));

    const spokeRegistry = await new SpokeRegistry__factory(signer).deploy();
    await waitAndRegister(spokeRegistry, "spokeRegistry", verbose);

    const vault = await new Vault__factory(signer).deploy(
        tokenRegistry.address,
        spokeRegistry.address
    );
    await waitAndRegister(vault, "vault", verbose);

    // deploy deposit manager
    const depositManager = await new DepositManager__factory(signer).deploy(
        tokenRegistry.address,
        vault.address,
        parameters.MAX_DEPOSIT_SUBTREE_DEPTH
    );
    await waitAndRegister(depositManager, "depositManager", verbose);

    if (!parameters.GENESIS_STATE_ROOT) throw new GenesisNotSpecified();

    // deploy Rollup core
    const rollup = await new Rollup__factory(signer).deploy(
        chooserAddress,
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
    await waitAndRegister(rollup, "rollup", verbose);

    await waitUntilMined(vault.setRollupAddress(rollup.address));
    await waitUntilMined(depositManager.setRollupAddress(rollup.address));

    const withdrawManager = await new WithdrawManager__factory(signer).deploy(
        tokenRegistry.address,
        vault.address,
        rollup.address
    );
    await waitAndRegister(withdrawManager, "withdrawManager", verbose);
    await waitUntilMined(spokeRegistry.registerSpoke(withdrawManager.address));

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
        burnAuction,
        exampleToken,
        spokeRegistry,
        vault,
        depositManager,
        rollup,
        withdrawManager
    };
}

async function waitUntilMined(tx: Promise<ContractTransaction>) {
    await (await tx).wait();
}

export async function deployAndWriteGenesis(
    signer: Signer,
    parameters: DeploymentParameters,
    genesisPath: string = "genesis.json"
) {
    const { provider } = signer;
    if (!provider) {
        throw new Error("signer missing provider");
    }

    const [genesisEth1Block, network] = await Promise.all([
        provider.getBlockNumber(),
        provider.getNetwork()
    ]);

    await deployKeyless(signer, true);
    const contracts = await deployAll(signer, parameters, true);

    const genesis = await Genesis.fromContracts(
        contracts,
        parameters,
        genesisEth1Block,
        network.chainId
    );
    await genesis.dump(genesisPath);
    console.log("Successsfully deployed", "genesis", genesis.toString());

    return contracts;
}
