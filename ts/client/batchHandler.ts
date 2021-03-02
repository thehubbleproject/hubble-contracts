import { Event } from "ethers";
import { Rollup } from "../../types/ethers-contracts/Rollup";
import { Batch, batchFactory } from "../commitments";

export async function handleNewBatch(
    event: Event,
    rollup: Rollup
): Promise<Batch> {
    const ethTx = await event.getTransaction();
    const data = ethTx?.data as string;
    const txDescription = rollup.interface.parseTransaction({ data });
    const batchID = event.args?.batchID;
    const batchType = event.args?.batchType;
    const accountRoot = event.args?.accountRoot;
    const batch = batchFactory(batchType, txDescription, accountRoot);
    const commitmentRoot = (await rollup.batches(batchID)).commitmentRoot;
    if (batch.commitmentRoot != commitmentRoot) {
        throw new Error(
            `Mismatched commitmentRoot  onchain ${commitmentRoot}  parsed ${batch.commitmentRoot}`
        );
    }
    return batch;
}
