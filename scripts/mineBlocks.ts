import { mineBlocks } from "../ts/utils";
import { ethers } from "ethers";

const argv = require("minimist")(process.argv.slice(2));

// Assuming a node is already running `npm run node`
// npx ts-node ./scripts/mineBlocks.ts -n 5
async function main() {
    const provider = new ethers.providers.JsonRpcProvider(argv.url);
    await mineBlocks(provider, argv.n);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
