import fastify from "fastify";
import minimist from "minimist";
import { HubbleNode } from "./node";
import { configFromPath } from "./config";
import { terminus } from "./terminus";

const { configPath } = minimist(process.argv.slice(2), {
    string: ["configPath"]
});

async function main() {
    console.info("Starting Hubble node...");
    const config = await configFromPath(configPath);

    const fast = fastify({ logger: true, maxParamLength: 512 });
    fast.setErrorHandler(console.error);

    const node = await HubbleNode.init(config, fast);
    await node.start();

    terminus(node, fast.server);

    const { address, port } = config.rpc ?? {};
    await fast.listen(port ?? 3000, address);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
