import { HubbleNode, NodeType } from "../ts/client/node";
import { AbortController } from "abort-controller";
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

    const node = await HubbleNode.init(nodeType);
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
