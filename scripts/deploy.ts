import { ethers } from "ethers";
import { deployAndWriteGenesis } from "../ts/deploy";
import { DeploymentParameters } from "../ts/interfaces";
import fs from "fs";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { StateTree } from "../ts/stateTree";

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

    console.log("Deploy with parameters", parameters);

    await deployAndWriteGenesis(signer, parameters, argv.output);
}

main();
