import repl from "repl";
import { Hubble } from "../ts/hubble";
import { ethers } from "ethers";

function startRepl() {
    const hubble = Hubble.fromDefault();
    const local = repl.start("hubble > ");
    local.context.hubble = hubble;
    local.context.ethers = ethers;
}

startRepl();
