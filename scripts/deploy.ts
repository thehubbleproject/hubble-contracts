import { ethers } from "ethers";
import { allContracts } from "../ts/allContractsInterfaces";
import { deployAll } from "../ts/deploy";
import { DeploymentParameters } from "../ts/interfaces";
import { toWei } from "../ts/utils";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";
import fs from "fs";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { StateTree } from "../ts/stateTree";
import { State } from "../ts/state";

const argv = require("minimist")(process.argv.slice(2), {
    string: ["url", "root", "pubkeys"]
});
/*
    Note separate pubkeys with commas
    > npm run deploy -- --url http://localhost:8545 \
    --root 0x309976060df37ed6961ebd53027fe0c45d3cbbbdfc30a5039e86b2a7aa7fed6e \
    --pubkeys 06642b1af0ec2f7369126b3e45aaf11a050a26e2111150b319c4ca2f4a8d48c62442e01b651ce469632972f06c4d5d092da2cde3d42c0ead5ebeed8646d72b3f1f09c41c70cbdd8779920b4a3b15e6c7c518c5fdb93fdaed7a49c59b1f4d1e210aafa7a17239c9df9053ca4e71f10fb9f7b0f219e12e300676a756463253c287,2a7575b1bddf2c2b25f976788baae059ea410f589f0c244e1554d6f6f5398b6a1b997670d19c26c33ad1c61e21bd2742565518e0deafb105e7718de983bf757a0770cb4889aabb6f4897534f4770fce4b76f39b2cc8ed63b22e55ebf7e87a96001bbabd11ca55585bc0c016ad058a69c682cbe102a4b91f6084c71c857509dac
*/

function getDefaultGenesisRoot(parameters: DeploymentParameters) {
    const stateTree = StateTree.new(parameters.MAX_DEPTH);
    const LARGE_AMOUNT = 1000000000;
    const state0 = State.new(0, 0, LARGE_AMOUNT, 0);
    state0.setStateID(0);
    const state1 = State.new(1, 0, LARGE_AMOUNT, 0);
    state1.setStateID(1);
    stateTree.createStateBulk([state0, state1]);
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

    if (argv.pubkeys) {
        const pubkeys = argv.pubkeys.split(",");
        await registerPublicKeys(contracts.blsAccountRegistry, pubkeys);
    }
}

async function registerPublicKeys(
    blsAccountRegistry: BlsAccountRegistry,
    pubkeys: string[]
) {
    console.log(`Registering ${pubkeys.length} public keys`);
    for (const pubkeyRaw of pubkeys) {
        const parsedPubkey = [
            pubkeyRaw.slice(64, 128),
            pubkeyRaw.slice(0, 64),
            pubkeyRaw.slice(192, 256),
            pubkeyRaw.slice(128, 192)
        ].map(_ => "0x" + _);
        console.log("Registering", parsedPubkey);
        const tx = await blsAccountRegistry.register(parsedPubkey);
        await tx.wait();
        console.log("Done registering pubkey", pubkeyRaw.slice(0, 5));
    }
}

main();
