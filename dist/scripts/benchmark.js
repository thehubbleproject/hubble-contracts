"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buidler_1 = require("@nomiclabs/buidler");
const commitments_1 = require("../ts/commitments");
const constants_1 = require("../ts/constants");
const deploy_1 = require("../ts/deploy");
const tx_1 = require("../ts/tx");
const child_process_1 = require("child_process");
const txPerCommitment = 32;
const commitmentsPerBatch = 32;
const blockTime = 13;
const blockGasLimit = 12500000;
async function main() {
    const [signer, ...rest] = await buidler_1.ethers.getSigners();
    const constracts = await deploy_1.deployAll(signer, constants_1.TESTING_PARAMS);
    let commitments = [];
    for (let i = 0; i < commitmentsPerBatch; i++) {
        let commitment = commitments_1.TransferCommitment.new(buidler_1.ethers.constants.HashZero);
        let transactions = [];
        for (let j = 0; j < txPerCommitment; j++) {
            transactions.push(tx_1.TxTransfer.rand());
        }
        commitment.txs = tx_1.serialize(transactions);
        commitments.push(commitment);
    }
    const batch = new commitments_1.TransferBatch(commitments);
    const tx = await batch.submit(constracts.rollup, constants_1.TESTING_PARAMS.STAKE_AMOUNT);
    const receipt = await tx.wait();
    const revision = child_process_1.execSync("git rev-parse HEAD")
        .toString()
        .trim();
    const totalTxs = txPerCommitment * commitmentsPerBatch;
    const submitBatchGas = receipt.gasUsed.toNumber();
    const gasPerTx = submitBatchGas / totalTxs;
    const tps = blockGasLimit / gasPerTx / blockTime;
    console.log("=============================");
    console.log("Revision", revision);
    console.log(`submitTransferBatch: Gas cost execution cost for ${txPerCommitment} x ${commitmentsPerBatch} txs`, submitBatchGas);
    console.log("Transaction per second", tps.toFixed(2));
    console.log("Gas per transaction", gasPerTx.toFixed(2));
    console.log(`(Assuming ${blockGasLimit} block gas limit and ${blockTime} seconds block time for ${totalTxs} txs)`);
}
main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=benchmark.js.map