import repl from "repl";
import { Hubble } from "../ts/hubble";
import fs from "fs";
import { ethers } from "ethers";

function loadGenesis(path: string) {
    const genesis = fs.readFileSync(path).toString();
    const { parameters, addresses } = JSON.parse(genesis);
    return { parameters, addresses };
}

async function prepareHubble() {
    const { parameters, addresses } = loadGenesis("./genesis.json");
    const provider = new ethers.providers.JsonRpcProvider(
        "http://localhost:8545"
    );
    const signer = provider.getSigner();
    const hubble = Hubble.fromGenesis(parameters, addresses, signer);
    return hubble;
}

async function startRepl() {
    const hubble = await prepareHubble();
    const local = repl.start("hubble > ");
    local.context.hubble = hubble;
    local.context.ethers = ethers;
}

startRepl();
