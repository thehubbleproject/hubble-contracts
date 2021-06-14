import { ethers, providers } from "ethers";
import minimist from "minimist";
import {
    calculateAddresses,
    deployerBytecode,
    DEPLOYER_ADDRESS,
    KEYLESS_DEPLOYMENT
} from "../ts/deployment/static";
import { deployKeyless } from "../ts/deployment/deploy";
import { KeylessDeployer } from "../ts/deployment/keylessDeployment";

const argv = minimist(process.argv.slice(2), {
    string: ["url", "root"],
    boolean: ["check", "deploy", "offline"]
});

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(argv.url);
    if (argv.check) {
        if (argv.offline) {
            await checkKeylessDeploymentSetup();
        } else {
            await checkKeylessDeploymentSetup(provider);
        }
    } else if (argv.deploy) {
        await deploy(provider);
    }
}

// npx hardhat node
// npm run keyless:deploy -- --url http://localhost:8545
async function deploy(provider: providers.JsonRpcProvider) {
    const signer = provider.getSigner();
    const verbose = true;
    await deployKeyless(signer, verbose);
}

// npx hardhat node
// npm run keyless:check -- --url http://localhost:8545
async function checkKeylessDeploymentSetup(
    provider?: providers.JsonRpcProvider
) {
    // Gas Limit
    if (provider) {
        const deployer = new KeylessDeployer(deployerBytecode()).connect(
            provider
        );
        const keylessTxGasCost = await deployer.estimateGas();
        if (keylessTxGasCost.gt(KEYLESS_DEPLOYMENT.GAS_LIMIT)) {
            console.log(`WARNING: Gas Limit Insufficient
        expected: ${keylessTxGasCost.toString()}
        have: ${KEYLESS_DEPLOYMENT.GAS_LIMIT.toString()}\n`);
        } else {
            console.log("Gas Limit is OK\n");
        }
    }

    // Gas Cost
    if (provider) {
        const currentGasPrice = await provider.getGasPrice();
        if (currentGasPrice.gt(KEYLESS_DEPLOYMENT.GAS_PRICE)) {
            console.log(`WARNING: Gas Price Insufficient
            expected: ${currentGasPrice.toString()}
            have: ${KEYLESS_DEPLOYMENT.GAS_LIMIT.toString()}\n`);
        } else {
            console.log("Gas Price is OK (for now)\n");
        }
    }

    const addresses = calculateAddresses();

    if (addresses.deployer != DEPLOYER_ADDRESS) {
        console.log(`WARNING: Bad Deployer Adress
    expected: ${addresses.deployer}
    have: ${DEPLOYER_ADDRESS}\n`);
    } else {
        console.log("Deployer Address is OK\n");
    }

    console.log("Adresses:\n");
    console.log(addresses);

    // TODO: report deployment status.
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
