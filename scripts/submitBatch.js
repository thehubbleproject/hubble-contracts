const { ethers } = require("ethers");
const contractAddresses = require("../contractAddresses.json");
const path = require("path");

const RollupContract = require("../build/contracts/Rollup.json");
const GovernanceContract = require("../build/contracts/Governance.json");

const argv = require("minimist")(process.argv.slice(2), {
    string: ["batches"]
});

/*
    $ wget https://gist.githubusercontent.com/vaibhavchellani/3c1f19925cf2d3a26edf218ff7cff33d/raw/7f4234f7daa6e99043f095df477d93c76708c504/commitments.json
    $ node ./scripts/submitBatch.js --batches commitments.json
*/

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

    const batches = rawJSON.users;
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

    for (const batch of batches) {
        console.log("Processing batch", batch.index);
        if (batch.root === "") {
            console.log("Batch", batch.index, "is empty, skip.");
            console.log(batch);
            continue;
        }

        try {
            const tx = await rollupInstance.submitBatch(
                `0x${batch.txs}`,
                batch.root,
                batch.type,
                { value: stakeAmount }
            );
            // Do callback here to unblock next tx
            tx.wait().then(receipt => {
                console.log("submited batch", batch.index);
            });
        } catch (err) {
            console.error(err.message);
            console.log(batch);
        }
    }
}

main();
