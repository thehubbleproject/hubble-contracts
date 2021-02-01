import { ethers } from "ethers";
import { allContracts } from "../ts/allContractsInterfaces";
import { deployAll } from "../ts/deploy";
import { DeploymentParameters } from "../ts/interfaces";
import fs from "fs";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { StateTree } from "../ts/stateTree";
import { execSync } from "child_process";
import { deployKeyless } from "../ts/deployment/deploy";

const argv = require("minimist")(process.argv.slice(2), {
    string: ["url", "root", "key", "input", "output"]
});
/*
    Note separate pubkeys with commas
    > npm run deploy -- --url http://localhost:8545 \
    --root 0x309976060df37ed6961ebd53027fe0c45d3cbbbdfc30a5039e86b2a7aa7fed6e

    You can also specify a private key
    > npm run deploy -- --key 0xYourPrivateKey 

    You can use a custom parameters.json
    > npm run deploy -- --input parameters.json --output ../hubbe-commander/genesis.json
*/

function getDefaultGenesisRoot(parameters: DeploymentParameters) {
    const stateTree = StateTree.new(parameters.MAX_DEPTH);
    // An completely empty genesis state
    // Can add states here
    return stateTree.root;
}

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(
        argv.url ?? "http://localhost:8545"
    );
    const signer = argv.key
        ? new ethers.Wallet(argv.key).connect(provider)
        : provider.getSigner();

    const parameters = argv.input
        ? JSON.parse(fs.readFileSync(argv.input).toString())
        : PRODUCTION_PARAMS;

    parameters.GENESIS_STATE_ROOT =
        argv.root || getDefaultGenesisRoot(parameters);

    const genesisPath = argv.output ?? "genesis.json";

    console.log("Deploy with parameters", parameters);

    const genesisEth1Block = await provider.getBlockNumber();
    await deployKeyless(signer, true);
    const contracts = await deployAll(signer, parameters, true);
    let addresses: { [key: string]: string } = {};
    Object.keys(contracts).map((contract: string) => {
        addresses[contract] = contracts[contract as keyof allContracts].address;
    });
    const appID = await contracts.rollup.appID();
    const version = execSync("git rev-parse HEAD")
        .toString()
        .trim();
    const auxiliary = {
        domain: appID,
        genesisEth1Block,
        version
    };
    const configs = { parameters, addresses, auxiliary };
    console.log("Writing genesis file to", genesisPath);
    fs.writeFileSync(genesisPath, JSON.stringify(configs, null, 4));
    console.log("Successsfully deployed", configs);
}

main();
