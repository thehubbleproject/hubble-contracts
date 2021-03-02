import { HubbleNode } from "../ts/client/node";
import { AbortController } from "abort-controller";
import { sleep } from "../ts/utils";

async function main() {
    const abortController = new AbortController();

    for (const signal of ["SIGTERM", "SIGINT"] as NodeJS.Signals[]) {
        process.once(signal, async () => {
            abortController.abort();
        });
    }

    const node = await HubbleNode.init();
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
