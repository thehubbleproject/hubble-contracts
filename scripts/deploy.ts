import { ethers } from "ethers";
import { allContracts } from "../ts/allContractsInterfaces";
import { deployAll } from "../ts/deploy";
import { DeploymentParameters } from "../ts/interfaces";
import fs from "fs";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { StateTree } from "../ts/stateTree";

const argv = require("minimist")(process.argv.slice(2), {
    string: ["url", "root"]
});
/*
    Note separate pubkeys with commas
    > npm run deploy -- --url http://localhost:8545 \
    --root 0x309976060df37ed6961ebd53027fe0c45d3cbbbdfc30a5039e86b2a7aa7fed6e
*/

function getDefaultGenesisRoot(parameters: DeploymentParameters) {
    const stateTree = StateTree.new(parameters.MAX_DEPTH);
    // An completely empty genesis state
    // Can add states here
    return stateTree.root;
}

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(argv.url);
    const signer = provider.getSigner();
    // const signer = new ethers.Wallet(
    //     "0xyourprivatekeyhere"
    // ).connect(provider);

    const parameters = PRODUCTION_PARAMS;
    parameters.GENESIS_STATE_ROOT =
        argv.root || getDefaultGenesisRoot(parameters);

    const contracts = await deployAll(signer, parameters, true);
    let addresses: { [key: string]: string } = {};
    Object.keys(contracts).map((contract: string) => {
        addresses[contract] = contracts[contract as keyof allContracts].address;
    });
    const configs = { parameters, addresses };
    console.log("Writing genesis.json");
    fs.writeFileSync("genesis.json", JSON.stringify(configs, null, 4));
    console.log("Successsfully deployed", configs);
}

main();
