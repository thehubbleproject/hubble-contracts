import repl from "repl";
import { Hubble } from "../ts/hubble";
import { ethers } from "ethers";
import * as mcl from "../ts/mcl";

async function startRepl() {
    await mcl.init();
    const hubble = Hubble.fromDefault();
    const local = repl.start("hubble > ");
    local.context.hubble = hubble;
    local.context.ethers = ethers;
}

startRepl()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
