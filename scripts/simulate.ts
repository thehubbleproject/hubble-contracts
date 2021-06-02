import { AbortController } from "abort-controller";
import { BigNumber } from "ethers";
import { NodeType } from "../ts/client/constants";
import { HubbleNode } from "../ts/client/node";
import { sleep } from "../ts/utils";

const argv = require("minimist")(process.argv.slice(2), {
    boolean: ["proposer"]
});

async function main() {
    const abortController = new AbortController();

    for (const signal of ["SIGTERM", "SIGINT"] as NodeJS.Signals[]) {
        process.once(signal, async () => {
            abortController.abort();
        });
    }
    const nodeType = argv.proposer ? NodeType.Proposer : NodeType.Syncer;
    const config = {
        nodeType,
        providerUrl: "http://localhost:8545",
        genesisPath: "./genesis.json",
        rpcPort: 3000,
        proposer: {
            willingnessToBid: BigNumber.from(1)
        }
    };

    const node = await HubbleNode.init(config);
    await node.start();
    abortController.signal.addEventListener("abort", () => node.close(), {
        once: true
    });
    while (!abortController.signal.aborted) {
        await sleep(1000);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
