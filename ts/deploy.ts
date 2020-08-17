import { ParamManagerFactory } from "../types/ethers-contracts/ParamManagerFactory";
import { RollupUtilsFactory } from "../types/ethers-contracts/RollupUtilsFactory";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { NameRegistryFactory } from "../types/ethers-contracts/NameRegistryFactory";
import { GovernanceFactory } from "../types/ethers-contracts/GovernanceFactory";
import { MerkleTreeUtilsFactory } from "../types/ethers-contracts/MerkleTreeUtilsFactory";
import { MerkleTreeUtils } from "../types/ethers-contracts/MerkleTreeUtils";
import { LoggerFactory } from "../types/ethers-contracts/LoggerFactory";
import { TokenRegistryFactory } from "../types/ethers-contracts/TokenRegistryFactory";
import { PobFactory } from "../types/ethers-contracts/PobFactory";
import { CreateAccountFactory } from "../types/ethers-contracts/CreateAccountFactory";
import { AirdropFactory } from "../types/ethers-contracts/AirdropFactory";
import { TransferFactory } from "../types/ethers-contracts/TransferFactory";
import { BurnConsentFactory } from "../types/ethers-contracts/BurnConsentFactory";
import { BurnExecutionFactory } from "../types/ethers-contracts/BurnExecutionFactory";
import { TestTokenFactory } from "../types/ethers-contracts/TestTokenFactory";
import { DepositManagerFactory } from "../types/ethers-contracts/DepositManagerFactory";
import { RollupFactory } from "../types/ethers-contracts/RollupFactory";
import { RollupRedditFactory } from "../types/ethers-contracts/RollupRedditFactory";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";

import { Signer, Contract } from "ethers";
import { DeploymentParameters } from "./interfaces";

export async function deployAll(
    signer: Signer,
    parameters: DeploymentParameters
): Promise<{ [key: string]: Contract }> {
    // deploy libs

    const paramManager = await new ParamManagerFactory(signer).deploy();
    await paramManager.deployed();
    console.log("paramManager", paramManager.address);

    const rollupUtils = await new RollupUtilsFactory(signer).deploy();
    await rollupUtils.deployed();
    console.log("rollupUtils", rollupUtils.address);

    // deploy name registry
    const nameRegistry = await new NameRegistryFactory(signer).deploy();
    await nameRegistry.deployed();
    console.log("nameRegistry", nameRegistry.address);

    // deploy governance
    const governance = await new GovernanceFactory(signer).deploy(
        parameters.MAX_DEPTH,
        parameters.MAX_DEPOSIT_SUBTREE_DEPTH
    );
    await governance.deployed();
    await nameRegistry.registerName(
        await paramManager.Governance(),
        governance.address
    );
    console.log("governance", governance.address);

    // deploy logger
    const logger = await new LoggerFactory(signer).deploy();
    await logger.deployed();
    await nameRegistry.registerName(
        await paramManager.LOGGER(),
        logger.address
    );
    console.log("logger", logger.address);

    const allLinkRefs = {
        __$b941c30c0f5422d8b714f571f17d94a5fd$__: paramManager.address,
        __$a6b8846b3184b62d6aec39d1f36e30dab3$__: rollupUtils.address
    };

    // deploy MTUtils
    const merkleTreeUtils = await new MerkleTreeUtilsFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await merkleTreeUtils.deployed();
    await nameRegistry.registerName(
        await paramManager.MERKLE_UTILS(),
        merkleTreeUtils.address
    );
    console.log("merkleTreeUtils", merkleTreeUtils.address);

    const blsAccountRegistry = await new BlsAccountRegistryFactory(
        signer
    ).deploy(logger.address);
    await blsAccountRegistry.deployed();
    await nameRegistry.registerName(
        await paramManager.ACCOUNT_REGISTRY(),
        blsAccountRegistry.address
    );
    console.log("blsAccountRegistry", blsAccountRegistry.address);

    // deploy Token registry contract
    const tokenRegistry = await new TokenRegistryFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await tokenRegistry.deployed();
    await (
        await nameRegistry.registerName(
            await paramManager.TOKEN_REGISTRY(),
            tokenRegistry.address
        )
    ).wait();
    console.log("tokenRegistry", tokenRegistry.address);

    // deploy Reddit contracts

    const createAccount = await new CreateAccountFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await createAccount.deployed();
    await nameRegistry.registerName(
        await paramManager.CREATE_ACCOUNT(),
        createAccount.address
    );
    console.log("createAccount", createAccount.address);

    const airdrop = await new AirdropFactory(allLinkRefs, signer).deploy(
        nameRegistry.address
    );
    await airdrop.deployed();
    await nameRegistry.registerName(
        await paramManager.AIRDROP(),
        airdrop.address
    );
    console.log("airdrop", airdrop.address);

    const transfer = await new TransferFactory(allLinkRefs, signer).deploy();
    await transfer.deployed();
    await nameRegistry.registerName(
        await paramManager.TRANSFER(),
        transfer.address
    );

    console.log("transfer", transfer.address);
    const burnConsent = await new BurnConsentFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await burnConsent.deployed();
    await nameRegistry.registerName(
        await paramManager.BURN_CONSENT(),
        burnConsent.address
    );

    console.log("burnConsent", burnConsent.address);
    const burnExecution = await new BurnExecutionFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await burnExecution.deployed();
    await nameRegistry.registerName(
        await paramManager.BURN_EXECUTION(),
        burnExecution.address
    );
    console.log("burnExecution", burnExecution.address);

    // deploy POB contract
    const pob = await new PobFactory(signer).deploy();
    await pob.deployed();
    await nameRegistry.registerName(await paramManager.POB(), pob.address);
    console.log("pob", pob.address);

    // deploy test token
    const testToken = await new TestTokenFactory(signer).deploy();
    await testToken.deployed();
    await nameRegistry.registerName(
        await paramManager.TEST_TOKEN(),
        testToken.address
    );
    console.log("testToken", testToken.address);

    // deploy deposit manager
    const depositManager = await new DepositManagerFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await depositManager.deployed();
    await nameRegistry.registerName(
        await paramManager.DEPOSIT_MANAGER(),
        depositManager.address
    );
    console.log("depositManager", depositManager.address);

    const rollupReddit = await new RollupRedditFactory(
        allLinkRefs,
        signer
    ).deploy(nameRegistry.address);
    await rollupReddit.deployed();
    await nameRegistry.registerName(
        await paramManager.ROLLUP_REDDIT(),
        rollupReddit.address
    );
    console.log("rollupReddit", rollupReddit.address);

    const root =
        parameters.GENESIS_STATE_ROOT ||
        (await getMerkleRootWithCoordinatorAccount(
            rollupUtils,
            merkleTreeUtils,
            parameters
        ));

    // deploy Rollup core
    const rollup = await new RollupFactory(allLinkRefs, signer).deploy(
        nameRegistry.address,
        root
    );
    await rollup.deployed();
    await nameRegistry.registerName(
        await paramManager.ROLLUP_CORE(),
        rollup.address
    );
    console.log("rollup", rollup.address);
    return {
        paramManager,
        rollupUtils,
        nameRegistry,
        governance,
        logger,
        merkleTreeUtils,
        blsAccountRegistry,
        tokenRegistry,
        createAccount,
        airdrop,
        transfer,
        burnConsent,
        burnExecution,
        pob,
        testToken,
        depositManager,
        rollupReddit,
        rollup
    };
}

async function getMerkleRootWithCoordinatorAccount(
    rollupUtils: RollupUtils,
    merkleTreeUtils: MerkleTreeUtils,
    parameters: DeploymentParameters
) {
    const dataLeaves = await rollupUtils.GetGenesisLeaves();
    const ZERO_BYTES32 =
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    for (let i = dataLeaves.length; i < 2 ** parameters.MAX_DEPTH; i++) {
        dataLeaves[i] = ZERO_BYTES32;
    }
    const result = await merkleTreeUtils.getMerkleRootFromLeaves(dataLeaves);
    return result;
}
