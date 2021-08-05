import fastify from "fastify";
import minimist from "minimist";
import { HubbleNode } from "./node";
import { configFromPath } from "./config";
import { terminus } from "./terminus";

/**
 * Main entry point to Hubble node
 *
 * options:
 * --configPath Path to JSON config file (default: ./config.local.json)
 * --providerUrl ETH1 provider (default: http://localhost:8545)
 * --privateKey ETH1 private key (default: ethers.js default signer)
 *
 */
const { configPath, providerUrl, privateKey } = minimist(
    process.argv.slice(2),
    {
        string: ["configPath", "providerUrl", "privateKey"]
    }
);

async function main() {
    console.info("Starting Hubble node...");
    const config = await configFromPath(configPath);

    const fast = fastify({ logger: true, maxParamLength: 512 });
    fast.setErrorHandler(console.error);

    const node = await HubbleNode.init(config, fast, {
        providerUrl,
        privateKey
    });
    await node.start();

    terminus(node, fast.server);

    const { address, port } = config.rpc ?? {};
    await fast.listen(port ?? 3000, address);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
