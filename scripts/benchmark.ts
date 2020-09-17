import { ethers } from "@nomiclabs/buidler";
import { TransferBatch, TransferCommitment } from "../ts/commitments";
import { TESTING_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";
import { serialize, TxTransfer } from "../ts/tx";

const txPerCommitment = 32;
const commitmentsPerBatch = 32;

async function main() {
    const [signer, ...rest] = await ethers.getSigners();

    const constracts = await deployAll(signer, TESTING_PARAMS);
    let commitments = [];
    for (let i = 0; i < commitmentsPerBatch; i++) {
        let commitment = TransferCommitment.new(ethers.constants.HashZero);
        let transactions = [];
        for (let j = 0; j < txPerCommitment; j++) {
            transactions.push(TxTransfer.rand());
        }
        const { serialized } = serialize(transactions);
        commitment.txs = serialized;
        commitments.push(commitment);
    }
    const batch = new TransferBatch(commitments);

    const tx = await batch.submit(
        constracts.rollup,
        TESTING_PARAMS.STAKE_AMOUNT
    );
    const receipt = await tx.wait();
    console.log(
        `submitTransferBatch: Gas cost execution cost for ${txPerCommitment} x ${commitmentsPerBatch} txs`,
        receipt.gasUsed.toNumber()
    );
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
