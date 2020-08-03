const { ethers } = require("ethers");
const contractAddresses = require("../contractAddresses.json");

const RollupContract = require("../build/contracts/Rollup.json");

const argv = require("minimist")(process.argv.slice(2), {
    string: ["batches"]
});

/*
    $ node ./scripts/submitBatch.js --batches batches.json
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

    const batches = [];

    for (const [index, batch] of batches.entries()) {
        txs = "";
        _updatedRoot = "";
        batchType = 0;

        const tx = await rollupInstance.submitBatch(
            txs,
            _updatedRoot,
            batchType
        );
        // Do callback here to unblock next tx
        tx.wait().then(x => {
            console.log("submited batch", index, "tx:", x);
        });
    }
}

main();
