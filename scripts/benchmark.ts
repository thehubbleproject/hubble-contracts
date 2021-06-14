import { ethers } from "hardhat";
import { TransferBatch, TransferCommitment } from "../ts/commitments";
import { TESTING_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";
import { serialize, TxTransfer } from "../ts/tx";
import { execSync } from "child_process";
import { constants } from "ethers";

const txPerCommitment = 32;
const commitmentsPerBatch = 32;
const blockTime = 13;
const blockGasLimit = 12500000;
const batchID = 1;

async function main() {
    const [signer, ...rest] = await ethers.getSigners();
    const parameters = TESTING_PARAMS;

    const constracts = await deployAll(signer, {
        ...TESTING_PARAMS,
        GENESIS_STATE_ROOT: constants.HashZero
    });
    let commitments = [];
    for (let i = 0; i < commitmentsPerBatch; i++) {
        let commitment = TransferCommitment.new(ethers.constants.HashZero);
        let transactions = [];
        for (let j = 0; j < txPerCommitment; j++) {
            transactions.push(TxTransfer.rand());
        }
        commitment.txs = serialize(transactions);
        commitments.push(commitment);
    }
    const batch = new TransferBatch(commitments);

    const tx = await batch.submit(
        constracts.rollup,
        batchID,
        TESTING_PARAMS.STAKE_AMOUNT
    );
    const receipt = await tx.wait();

    const revision = execSync("git rev-parse HEAD")
        .toString()
        .trim();

    const totalTxs = txPerCommitment * commitmentsPerBatch;
    const submitBatchGas = receipt.gasUsed.toNumber();
    const gasPerTx = submitBatchGas / totalTxs;
    const tps = blockGasLimit / gasPerTx / blockTime;

    console.log("=============================");
    console.log("Revision", revision);
    console.log(
        `submitTransferBatch: Gas cost execution cost for ${txPerCommitment} x ${commitmentsPerBatch} txs`,
        submitBatchGas
    );
    console.log("Transaction per second", tps.toFixed(2));
    console.log("Gas per transaction", gasPerTx.toFixed(2));
    console.log(
        `(Assuming ${blockGasLimit} block gas limit and ${blockTime} seconds block time for ${totalTxs} txs)`
    );
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
