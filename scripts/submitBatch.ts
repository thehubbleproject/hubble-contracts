import { ethers } from "ethers";
const contractAddresses = require("../contractAddresses.json");
import * as path from "path";
import { Usage } from "../scripts/helpers/interfaces";

const RollupContract = require("../build/contracts/Rollup.json");
const GovernanceContract = require("../build/contracts/Governance.json");

const argv = require("minimist")(process.argv.slice(2), {
    string: ["batches"]
});

/*
    $ wget https://gist.githubusercontent.com/vaibhavchellani/3c1f19925cf2d3a26edf218ff7cff33d/raw/7f4234f7daa6e99043f095df477d93c76708c504/commitments.json
    $ npx ts-node ./scripts/submitBatch.ts --batches commitments.json
*/

interface Batch {
    index: number;
    root: string;
    txs: string;
    type: Usage;
}

interface BatchByType {
    [key: number]: Batch[];
}

async function main() {
    const batchesFile = argv.batches;

    const provider = new ethers.providers.JsonRpcProvider();
    const signer = provider.getSigner();
    const rollupInstance = new ethers.Contract(
        contractAddresses.RollupContract,
        RollupContract.abi,
        signer
    );
    const rawJSON = require(path.join(process.cwd(), batchesFile));

    const governaceInstance = new ethers.Contract(
        contractAddresses.Governance,
        GovernanceContract.abi,
        signer
    );
    const stakeAmount = await governaceInstance.STAKE_AMOUNT();
    console.log(
        "stake amount is",
        ethers.utils.formatEther(stakeAmount),
        "ether"
    );

    const batchesSorted: BatchByType = rawJSON.users.reduce(
        (obj: BatchByType, batch: Batch) => {
            const batchType = batch.type;

            if (!obj.hasOwnProperty(batchType)) {
                obj[batchType] = [];
            }
            obj[batchType].push(batch);
            return obj;
        },
        {}
    );
    // console.log(batchesSorted)
    const order = [
        Usage.CreateAccount,
        Usage.BurnConsent,
        Usage.Airdrop,
        Usage.BurnExecution
    ];
    for (const txType of order) {
        console.log("[===== Processing ", Usage[txType], "=====]");
        const batches = batchesSorted[txType];
        for (const batch of batches) {
            await processBatch(batch, rollupInstance, stakeAmount);
        }
    }
}

async function processBatch(
    batch: Batch,
    rollupInstance: any,
    stakeAmount: number
) {
    console.log(`[${Usage[batch.type]}]`, "Processing batch", batch.index);
    if (batch.root === "") {
        console.log("Batch", batch.index, "is empty, skip.");
        console.log(batch);
        return;
    }
    try {
        const tx = await rollupInstance.submitBatch(
            `0x${batch.txs}`,
            batch.root,
            batch.type,
            { value: stakeAmount }
        );
        // Do callback here to unblock next tx
        tx.wait().then((receipt: any) => {
            console.log(
                "Batch",
                batch.index,
                "included in height",
                receipt.blockNumber
            );
        });
    } catch (err) {
        console.error(err.message);
        console.log(batch);
    }
}

main();
