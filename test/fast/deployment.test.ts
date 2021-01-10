import { ethers } from "hardhat";
import { keylessDeploy } from "../../ts/deployment/keylessDeployment";
import { SimpleStorageFactory } from "../../types/ethers-contracts/SimpleStorageFactory";
import { BigNumber, Wallet, utils, Signer } from "ethers";
import { assert } from "chai";
import { DeployerFactory } from "../../types/ethers-contracts/DeployerFactory";
import { randHex } from "../../ts/utils";
import { ProxyFactory } from "../../types/ethers-contracts/ProxyFactory";
import { deployDeployer } from "../../ts/deployment/deployDeployer";
import { deploy } from "../../ts/deployment/deploy";
import { isDeployerDeployed } from "../../ts/deployment/deployer";

const verbose = true;

describe("Deployer", async () => {
    let provider = ethers.provider;
    let signer: Signer;
    let feeder: Wallet;
    let proxyCodeHash: string;
    before(async function() {
        const signers = await ethers.getSigners();
        signer = signers[0];
        feeder = Wallet.createRandom().connect(provider);
        proxyCodeHash = utils.keccak256(new ProxyFactory().bytecode);
        await signer.sendTransaction({
            value: utils.parseEther("1"),
            to: feeder.address
        });
    });

    it("keyless", async function() {
        const factory = new SimpleStorageFactory(signer);
        const bytecode = factory.bytecode;
        const gasPrice = BigNumber.from(10e10);
        const gasLimit = await provider.estimateGas(
            factory.getDeployTransaction()
        );
        // prettier-ignore
        const result = await keylessDeploy(feeder, bytecode, gasPrice, gasLimit, verbose);
        const simpleStorage = factory.attach(result.contractAddress);
        await simpleStorage.setValue(23);
        const value = await simpleStorage.getValue();
        assert.isTrue(value.eq(23));
    });

    it("deployer", async function() {
        assert.isTrue(await deployDeployer(signer, verbose));
        assert.isTrue(await isDeployerDeployed(provider));
    });

    it("implementation and proxy", async function() {
        const simpleStorageFactory = new SimpleStorageFactory(signer);
        const salt = randHex(32);

        // prettier-ignore
        let result = await deploy(simpleStorageFactory, salt, "SimpleStorage", verbose);
        assert.isFalse(result.alreadyDeployed);

        result = await deploy(
            simpleStorageFactory,
            salt,
            "SimpleStorage",
            verbose
        );
        assert.isTrue(result.alreadyDeployed);

        const simpleStorage = simpleStorageFactory.attach(result.address);
        await simpleStorage.setValue(23);
        const value = await simpleStorage.getValue();
        assert.isTrue(value.eq(23));
    });
});
