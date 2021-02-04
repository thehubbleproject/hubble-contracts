import { mineBlocks } from "../ts/utils";
import { ethers } from "ethers";

const argv = require("minimist")(process.argv.slice(2));

// Assuming a node is already running `npm run node`
// npx ts-node ./scripts/mineBlocks.ts
async function main() {
    const provider = new ethers.providers.JsonRpcProvider(argv.url);

    setInterval(()=>{
        mineBlocks(provider, 1);
    }, 1000)
}

main()