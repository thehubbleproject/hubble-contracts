import Emittery from "emittery";
import { Hubble } from "../ts/hubble";
import { Group } from "../ts/factory";
import { deployAndWriteGenesis } from "../ts/deploy";
import { ethers } from "ethers";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { StateTree } from "../ts/stateTree";
import { USDT } from "../ts/decimal";

const argv = require("minimist")(process.argv.slice(2), {});

const emitter = new Emittery();

const events = {
    genTx: "genTx"
};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const provider = new ethers.providers.JsonRpcProvider();
    const signer = provider.getSigner();

    const parameters = PRODUCTION_PARAMS;
    const stateTree = StateTree.new(parameters.MAX_DEPTH);

    const group = Group.new({ n: 20, stateProvider: stateTree });

    for (const user of group.userIterator()) {
        console.log(`${user}`);
    }
    group.createStates({
        initialBalance: USDT.castInt(1000000000.0),
        tokenID: 0,
        zeroNonce: true
    });

    parameters.GENESIS_STATE_ROOT = stateTree.root;

    await deployAndWriteGenesis(signer, parameters);

    const hubble = Hubble.fromDefault();
    hubble.stateTree = stateTree;
    emitter.on(events.genTx, () => {
        const { user } = group.pickRandom();
        const state = hubble.getState(user.stateID);
        console.log(user.stateID, state.toString());
    });
    while (true) {
        await sleep(1000);
        emitter.emit(events.genTx);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
