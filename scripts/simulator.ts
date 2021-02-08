import Emittery from "emittery";
import { Hubble } from "../ts/hubble";
import { Group } from "../ts/factory";
import { deployAndWriteGenesis } from "../ts/deploy";
import { ethers } from "ethers";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { StateTree } from "../ts/stateTree";
import { USDT } from "../ts/decimal";
import { TxTransfer } from "../ts/tx";
import { arrayify } from "ethers/lib/utils";
import * as mcl from "../ts/mcl";

const argv = require("minimist")(process.argv.slice(2), {});

const emitter = new Emittery();

const events = {
    genTx: "genTx",
    bid: "bid",
    aggregate: "aggregate"
};

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    await mcl.init();
    const provider = new ethers.providers.JsonRpcProvider();
    const signer = provider.getSigner();
    const bob = provider.getSigner(1);
    const bobAddress = await bob.getAddress();

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
    group.setupSigners(arrayify(await hubble.contracts.rollup.appID()));
    hubble.stateTree = stateTree;
    hubble.registerHandlers();
    emitter.on(events.genTx, () => {
        const { user: sender } = group.pickRandom();
        const { user: receiver } = group.pickRandom();
        const senderState = hubble.getState(sender.stateID);
        const randomPercent = Math.floor(Math.random() * 100);
        const amount = USDT.castBigNumber(
            senderState.balance.div(100).mul(randomPercent)
        );
        const fee = USDT.castBigNumber(amount.div(10));
        const nonce = senderState.nonce;
        const tx = new TxTransfer(
            sender.stateID,
            receiver.stateID,
            amount,
            fee,
            nonce,
            USDT
        );
        tx.signature = sender.sign(tx);
        hubble.txpool.add(tx);
    });
    emitter.on(events.bid, () => {
        hubble.bid();
    });
    emitter.on(events.aggregate, () => {
        hubble.aggregate();
    });
    let programCounter = 0;
    while (true) {
        await sleep(1000);
        emitter.emit(events.genTx);
        console.log("Hubble pool size", hubble.txpool.size);
        if (programCounter % 5 == 0) emitter.emit(events.bid);
        if (programCounter % 10 == 0) emitter.emit(events.aggregate);
        // send tx to mine block
        await signer.sendTransaction({ to: bobAddress, value: 1 });
        programCounter++;
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
